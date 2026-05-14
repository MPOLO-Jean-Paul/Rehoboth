<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\Visit;
use App\Services\MobileMoneyPaymentService;
use App\Traits\NotifiesUsers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InvoiceController extends Controller
{
    use NotifiesUsers;
    public function checkInsuranceStatus($id)
    {
        $invoice = Invoice::with('patient.insurance')->findOrFail($id);
        
        if (!$invoice->patient || !$invoice->patient->is_insured || !$invoice->patient->insurance) {
            return response()->json([
                'success' => false,
                'message' => 'Ce patient n\'est pas rattaché à une assurance valide.'
            ], 404);
        }

        $insurance = $invoice->patient->insurance;
        $insurance->markExpiredIfNeeded();
        $isActive = $insurance->is_operational;

        return response()->json([
            'success' => $isActive,
            'status' => $insurance->status,
            'company' => $insurance->name,
            'message' => $isActive 
                ? "Le contrat avec {$insurance->name} est actif. Vous pouvez procéder à la prise en charge." 
                : "Le contrat avec {$insurance->name} est actuellement " . ($insurance->status === 'expired' ? 'expiré' : ($insurance->status === 'suspended' ? 'suspendu' : 'rompu')) . "."
        ]);
    }

    public function index(Request $request)
    {
        $this->performAutoJournalCheck();
        $limit = min(max($request->integer('limit', 200), 50), 500);

        $invoices = Invoice::with(['patient.insurance', 'visit'])
            ->whereIn('status', ['unpaid', 'insurance_billed'])
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get();
            
        return response()->json($invoices);
    }

    public function pay(Request $request, $id)
    {
        $request->validate([
            'payment_method' => 'required|string|in:cash,insurance,orange,airtel,mpesa',
            'payment_phone' => 'nullable|string',
            'payment_currency' => 'nullable|string|in:CDF,USD,FC',
        ]);

        return DB::transaction(function () use ($request, $id) {
            $invoice = Invoice::with(['visit.doctor', 'patient.insurance'])->lockForUpdate()->findOrFail($id);

            if ($invoice->status === 'paid') {
                return response()->json([
                    'message' => 'Cette facture est déjà payée.',
                    'invoice' => $invoice
                ], 409);
            }

            // Vérification de l'état du contrat d'assurance si paiement par assurance
            if ($request->payment_method === 'insurance' && $invoice->patient && $invoice->patient->insurance) {
                $invoice->patient->insurance->markExpiredIfNeeded();
                if (!$invoice->patient->insurance->is_operational) {
                    $statusLabel = match($invoice->patient->insurance->status) {
                        'expired' => 'expiré',
                        'suspended' => 'suspendu (Arrêté)',
                        'terminated' => 'rompu (Terminé)',
                        default => 'inactif'
                    };
                    return response()->json([
                        'message' => "Le contrat de l'assurance {$invoice->patient->insurance->name} est actuellement {$statusLabel}. Le paiement ne peut pas être validé au nom de la société."
                    ], 403);
                }
            }

            $method = $request->payment_method;
            $currency = strtoupper($request->input('payment_currency', 'CDF')) === 'FC' ? 'CDF' : strtoupper($request->input('payment_currency', 'CDF'));
            $metadata = $invoice->metadata ?? [];

            if (in_array($method, ['orange', 'airtel', 'mpesa'], true)) {
                if (!$request->filled('payment_phone')) {
                    return response()->json(['message' => 'Numéro mobile money requis.'], 422);
                }

                try {
                    $payment = app(MobileMoneyPaymentService::class)->charge(
                        $method,
                        $request->payment_phone,
                        (float) $invoice->amount,
                        $currency,
                        "Facture #{$invoice->id} - {$invoice->service}"
                    );
                } catch (\Throwable $e) {
                    return response()->json(['message' => $e->getMessage()], 422);
                }

                $invoice->payment_method = $method;
                $invoice->payment_phone = $request->payment_phone;
                $invoice->payment_currency = $currency;
                $invoice->payment_status = $payment['status'];
                $invoice->payment_reference = $payment['reference'] ?? null;
                $invoice->metadata = array_merge($metadata, ['mobile_money' => $payment]);

                if ($payment['status'] === 'pending') {
                    $invoice->save();

                    return response()->json([
                        'message' => $payment['message'],
                        'payment_status' => 'pending',
                        'invoice' => $invoice->fresh(),
                    ], 202);
                }

                if ($payment['status'] !== 'succeeded') {
                    $invoice->save();

                    return response()->json([
                        'message' => $payment['message'],
                        'payment_status' => 'failed',
                        'invoice' => $invoice->fresh(),
                    ], 422);
                }
            } else {
                $invoice->payment_method = $method;
                $invoice->payment_phone = $request->payment_phone;
                $invoice->payment_currency = $currency;
                $invoice->payment_status = 'succeeded';
            }

            $invoice->status = 'paid';
            $invoice->paid_amount = $invoice->amount;

            $session = \App\Models\CashierSession::where('status', 'open')->first();
            if ($session) {
                $invoice->cashier_session_id = $session->id;
            }

            if ($request->payment_method === 'insurance' && $invoice->patient && $invoice->patient->insurance_id) {
                $invoice->insurance_id = $invoice->patient->insurance_id;
            }
            
            $invoice->save();

            if ($invoice->visit) {
                $nextService = match ($invoice->service) {
                    'reception' => 'soins',
                    'labo'      => 'medecin',
                    default     => $invoice->visit->current_service,
                };

                $invoice->visit->current_service = $nextService;
                
                if ($invoice->service === 'labo') {
                    $invoice->visit->lab_order_status = 'paid';
                }
                
                if ($invoice->visit->status !== 'completed') {
                    $invoice->visit->status = 'pending';
                }
                $invoice->visit->save();

                // Notifications
                if ($nextService === 'medecin') {
                    $docName = $invoice->visit->doctor ? $invoice->visit->doctor->name : 'un médecin';
                    if ($invoice->visit->doctor_id) {
                        $this->notifyUser($invoice->visit->doctor_id, '👨‍⚕️ Patient de retour (Labo)', "Le patient {$invoice->patient->first_name} {$invoice->patient->last_name} a payé ses examens et vous est retourné.", ['visit_id' => $invoice->visit->id]);
                    } else {
                        $this->notifyRole('medecin', '👨‍⚕️ Patient de retour (Labo)', "Le patient {$invoice->patient->first_name} {$invoice->patient->last_name} a payé ses examens et attend consultation.", ['visit_id' => $invoice->visit->id]);
                    }
                } elseif ($nextService === 'soins') {
                    $this->notifyRole('soins', '🏥 Paiement Reçu', "Le paiement de {$invoice->patient->first_name} {$invoice->patient->last_name} a été validé. Le patient est transféré aux soins.", ['visit_id' => $invoice->visit->id]);
                }
            }

            return response()->json([
                'message' => 'Facture validée et payée. Le dossier a été transféré vers le service suivant.',
                'payment_status' => 'succeeded',
                'invoice' => $invoice
            ]);
        });
    }

    public function payAdvance(Request $request, $id)
    {
        $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'payment_method' => 'required|string|in:cash,insurance,orange,airtel,mpesa',
        ]);

        return DB::transaction(function () use ($request, $id) {
            $invoice = Invoice::lockForUpdate()->findOrFail($id);

            if ($invoice->status === 'paid' && $invoice->paid_amount >= $invoice->amount) {
                return response()->json(['message' => 'Cette facture est déjà soldée.', 'invoice' => $invoice], 409);
            }

            $newPaid = $invoice->paid_amount + $request->amount;
            
            if ($newPaid >= $invoice->amount) {
                $invoice->paid_amount = $invoice->amount;
                $invoice->status = 'paid';
            } else {
                $invoice->paid_amount = $newPaid;
                // keep status unpaid, or partial
            }

            $invoice->payment_method = $request->payment_method;
            $invoice->save();

            return response()->json([
                'message' => 'Acompte enregistré avec succès. ' . ($invoice->status === 'paid' ? 'Facture soldée.' : 'Reste à payer : ' . ($invoice->amount - $invoice->paid_amount)),
                'invoice' => $invoice
            ]);
        });
    }

    public function getHistory(Request $request)
    {
        $period = $request->query('period', 'day');
        $query = Invoice::query()->where('status', 'paid');
        
        $monthStart = now()->startOfMonth();
        $startDate = match($period) {
            'week' => now()->startOfWeek()->lt($monthStart) ? $monthStart : now()->startOfWeek(),
            'month' => $monthStart,
            'quarter' => now()->startOfQuarter()->lt($monthStart) ? $monthStart : now()->startOfQuarter(),
            'semester' => now()->month > 6 ? (now()->month(7)->startOfMonth()->lt($monthStart) ? $monthStart : now()->month(7)->startOfMonth()) : now()->startOfYear(),
            'year' => now()->startOfYear(),
            default => now()->startOfDay()->lt($monthStart) ? $monthStart : now()->startOfDay(),
        };

        if ($period !== 'all') {
            $query->where('created_at', '>=', $startDate);
        }
        // If 'all', no date filter applied

        $summary = (clone $query)
            ->selectRaw('COALESCE(SUM(amount), 0) as total, COUNT(*) as count')
            ->first();

        $invoices = (clone $query)
            ->with(['patient:id,first_name,last_name,post_name,is_insured,insurance_id', 'visit:id,current_service'])
            ->orderBy('created_at', 'desc')
            ->limit($request->boolean('all') ? 1000 : 300)
            ->get();

        $total = (float) $summary->total;
        $count = (int) $summary->count;

        return response()->json([
            'invoices' => $invoices,
            'total' => $total,
            'count' => $count,
            'by_service' => $this->paidInvoiceTotalsByServiceQuery($query)
        ]);
    }

    public function getDailySummary()
    {
        $today = now()->startOfDay();
        $tomorrow = $today->copy()->addDay();
        $yesterday = now()->subDay()->startOfDay();
        $yesterdayEnd = $today->copy();
        
        $todaySummary = Invoice::where('status', 'paid')
            ->where('created_at', '>=', $today)
            ->where('created_at', '<', $tomorrow)
            ->selectRaw('COALESCE(SUM(amount), 0) as total, COUNT(*) as count')
            ->first();

        $yesterdayTotal = Invoice::where('status', 'paid')
            ->where('created_at', '>=', $yesterday)
            ->where('created_at', '<', $yesterdayEnd)
            ->sum('amount');

        $todayTotal = (float) $todaySummary->total;
        
        $growth = $yesterdayTotal > 0 ? (($todayTotal - $yesterdayTotal) / $yesterdayTotal) * 100 : 0;

        $thisWeekTotal = Invoice::whereBetween('created_at', [now()->startOfWeek(), now()->endOfWeek()])->where('status', 'paid')->sum('amount');
        $lastWeekTotal = Invoice::whereBetween('created_at', [now()->subWeek()->startOfWeek(), now()->subWeek()->endOfWeek()])->where('status', 'paid')->sum('amount');
        $weekGrowth = $lastWeekTotal > 0 ? (($thisWeekTotal - $lastWeekTotal) / $lastWeekTotal) * 100 : 0;

        return response()->json([
            'today' => [
                'total' => (int) $todayTotal,
                'count' => (int) $todaySummary->count,
                'growth' => round($growth, 1)
            ],
            'week' => [
                'total' => (int) $thisWeekTotal,
                'growth' => round($weekGrowth, 1)
            ],
            'by_service' => $this->paidInvoiceTotalsByService($today, $tomorrow)
        ]);
    }

    private function groupPaidInvoicesByService($invoices)
    {
        return $invoices->groupBy(function($inv) {
            return $inv->service ?: ($inv->visit ? $inv->visit->current_service : 'Autre');
        })->map(function($group, $service) {
            $serviceNames = [
                'reception' => 'Frais de Dossier',
                'labo'      => 'Laboratoire',
                'pharmacie' => 'Pharmacie',
                'soins'     => 'Soins Infirmiers',
                'maternite' => 'Maternité',
                'caisse'    => 'Encaissements Directs',
                'consultation' => 'Consultations Médicales'
            ];
            return [
                'service' => $serviceNames[strtolower($service)] ?? ucfirst($service),
                'total' => (int) $group->sum('amount')
            ];
        })->values();
    }

    private function paidInvoiceTotalsByServiceQuery($query)
    {
        $serviceNames = [
            'reception' => 'Frais de Dossier',
            'labo'      => 'Laboratoire',
            'pharmacie' => 'Pharmacie',
            'soins'     => 'Soins Infirmiers',
            'maternite' => 'Maternité',
            'caisse'    => 'Encaissements Directs',
            'consultation' => 'Consultations Médicales'
        ];

        return (clone $query)
            ->selectRaw("COALESCE(service, 'Autre') as service_key, SUM(amount) as total")
            ->groupBy('service_key')
            ->get()
            ->map(function ($row) use ($serviceNames) {
                $key = strtolower($row->service_key ?? 'autre');

                return [
                    'service' => $serviceNames[$key] ?? ucfirst($row->service_key ?? 'Autre'),
                    'total' => (int) $row->total,
                ];
            })
            ->values();
    }

    public function getAccountingStats(Request $request)
    {
        $period = $request->query('period', 'day'); // day, week, month
        $query = Invoice::query();
        
        $monthStart = now()->startOfMonth();
        $startDate = match($period) {
            'week' => now()->startOfWeek()->lt($monthStart) ? $monthStart : now()->startOfWeek(),
            'month' => $monthStart,
            'quarter' => now()->startOfQuarter()->lt($monthStart) ? $monthStart : now()->startOfQuarter(),
            'semester' => now()->month > 6 ? (now()->month(7)->startOfMonth()->lt($monthStart) ? $monthStart : now()->month(7)->startOfMonth()) : now()->startOfYear(),
            'year' => now()->startOfYear(),
            default => now()->startOfDay()->lt($monthStart) ? $monthStart : now()->startOfDay(),
        };

        if ($period !== 'all') {
            $query->where('created_at', '>=', $startDate);
        }
        // If 'all', no date filter applied

        $summary = (clone $query)->where('status', 'paid')
            ->whereNull('cashier_session_id') // Balance de la session en cours uniquement
            ->selectRaw("
                COALESCE(SUM(CASE WHEN insurance_id IS NOT NULL THEN amount ELSE 0 END), 0) as insured,
                COALESCE(SUM(CASE WHEN insurance_id IS NULL THEN amount ELSE 0 END), 0) as private,
                COUNT(*) as count
            ")
            ->first();
        
        $insuredTotal = (float) $summary->insured;
        $privateTotal = (float) $summary->private;
        
        return response()->json([
            'insured' => $insuredTotal,
            'private' => $privateTotal,
            'total'   => $insuredTotal + $privateTotal,
            'count'   => (int) $summary->count
        ]);
    }

    private function paidInvoiceTotalsByService($start, $end)
    {
        $serviceNames = [
            'reception' => 'Frais de Dossier',
            'labo'      => 'Laboratoire',
            'pharmacie' => 'Pharmacie',
            'soins'     => 'Soins Infirmiers',
            'maternite' => 'Maternité',
            'caisse'    => 'Encaissements Directs',
            'consultation' => 'Consultations Médicales'
        ];

        return Invoice::where('status', 'paid')
            ->where('created_at', '>=', $start)
            ->where('created_at', '<', $end)
            ->selectRaw("COALESCE(service, 'Autre') as service_key, SUM(amount) as total")
            ->groupBy('service_key')
            ->get()
            ->map(function ($row) use ($serviceNames) {
                $key = strtolower($row->service_key ?? 'autre');

                return [
                    'service' => $serviceNames[$key] ?? ucfirst($row->service_key ?? 'Autre'),
                    'total' => (int) $row->total,
                ];
            })
            ->values();
    }

    public function getJournals()
    {
        $journals = \App\Models\CashierSession::orderBy('created_at', 'desc')
            ->get()
            ->map(function($session) {
                return [
                    'month' => $session->closed_at ? $session->closed_at->format('F Y') : $session->created_at->format('F Y'),
                    'count' => $session->invoices_count,
                    'total' => (int) $session->closing_amount,
                    'reference' => $session->reference,
                    'status' => $session->status,
                    'date' => $session->closed_at ? $session->closed_at->format('d/m/Y') : $session->created_at->format('d/m/Y')
                ];
            });
            
        return response()->json($journals);
    }

    public function getJournalDetails($id)
    {
        $session = \App\Models\CashierSession::with(['invoices.patient', 'user'])->where('reference', $id)->orWhere('id', $id)->firstOrFail();
        return response()->json($session);
    }

    public function getAutoJournalSettings()
    {
        return response()->json([
            'enabled' => \App\Models\Setting::getValue('auto_journal_enabled', 'false') === 'true',
            'frequency' => \App\Models\Setting::getValue('auto_journal_frequency', 'day'),
        ]);
    }

    public function updateAutoJournalSettings(Request $request)
    {
        $data = $request->validate([
            'enabled' => 'required|boolean',
            'frequency' => 'required|string|in:day,week,month,quarter,semester,year',
        ]);

        \App\Models\Setting::setValue('auto_journal_enabled', $data['enabled'] ? 'true' : 'false');
        \App\Models\Setting::setValue('auto_journal_frequency', $data['frequency']);

        // Déclencher une vérification immédiate
        $this->performAutoJournalCheck();

        return response()->json(['message' => 'Paramètres du journal automatique mis à jour.']);
    }

    private function performAutoJournalCheck()
    {
        if (\App\Models\Setting::getValue('auto_journal_enabled', 'false') !== 'true') return;

        $session = \App\Models\CashierSession::where('status', 'open')->first();
        $now = now();

        if (!$session) {
            \App\Models\CashierSession::create([
                'user_id' => auth()->id() ?: \App\Models\User::where('role', 'admin')->first()->id,
                'opening_amount' => 0,
                'status' => 'open',
                'opened_at' => $now,
                'reference' => 'JRN-AUTO-' . $now->format('Ymd-His')
            ]);
            return;
        }

        $frequency = \App\Models\Setting::getValue('auto_journal_frequency', 'day');
        $shouldClose = false;
        $openedAt = $session->opened_at;

        switch ($frequency) {
            case 'day': $shouldClose = !$openedAt->isToday(); break;
            case 'week': $shouldClose = $openedAt->diffInWeeks($now) >= 1; break;
            case 'month': $shouldClose = $openedAt->month !== $now->month || $openedAt->year !== $now->year; break;
            case 'quarter': 
                $oldQuarter = ceil($openedAt->month / 3);
                $newQuarter = ceil($now->month / 3);
                $shouldClose = $oldQuarter !== $newQuarter || $openedAt->year !== $now->year; 
                break;
            case 'semester': 
                $oldSemester = $openedAt->month <= 6 ? 1 : 2;
                $newSemester = $now->month <= 6 ? 1 : 2;
                $shouldClose = $oldSemester !== $newSemester || $openedAt->year !== $now->year;
                break;
            case 'year': $shouldClose = $openedAt->year !== $now->year; break;
        }

        if ($shouldClose) {
            // Clôturer l'actuel
            $this->closeSession(new Request());
            // Ouvrir le nouveau
            $this->performAutoJournalCheck(); // Récursif pour ouvrir
        }
    }

    public function storeJournal(Request $request)
    {
        // Vérifier si une session est déjà ouverte
        $existing = \App\Models\CashierSession::where('status', 'open')->first();
        if ($existing) {
            return response()->json([
                'status' => 'error',
                'message' => 'Une session de caisse est déjà ouverte (' . $existing->reference . ').'
            ], 400);
        }

        $session = \App\Models\CashierSession::create([
            'user_id' => $request->user()->id,
            'opening_amount' => $request->input('opening_amount', 0),
            'status' => 'open',
            'opened_at' => now(),
            'reference' => 'JRN-' . now()->format('Ymd-His')
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Session de caisse ouverte avec succès.',
            'session' => $session
        ]);
    }

    public function closeSession(Request $request)
    {
        return DB::transaction(function () use ($request) {
            $session = \App\Models\CashierSession::where('status', 'open')->first();
            
            if (!$session) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Aucune session ouverte à clôturer. Veuillez ouvrir un nouveau journal d\'abord.'
                ], 400);
            }

            // Récupérer les factures liées ou non liées mais payées
            $unclosedInvoices = Invoice::where('status', 'paid')
                ->where(function($q) use ($session) {
                    $q->whereNull('cashier_session_id')
                      ->orWhere('cashier_session_id', $session->id);
                })
                ->get();

            if ($unclosedInvoices->isEmpty()) {
                // On peut quand même clôturer une session vide
                $session->update([
                    'status' => 'closed',
                    'closed_at' => now()
                ]);
            } else {
                $total = $unclosedInvoices->sum('amount');
                $cash = $unclosedInvoices->where('payment_method', 'cash')->sum('amount');
                $mobile = $unclosedInvoices->whereIn('payment_method', ['mpesa', 'orange', 'airtel'])->sum('amount');
                $insured = $unclosedInvoices->whereNotNull('insurance_id')->sum('amount');

                $session->update([
                    'closing_amount' => $total,
                    'invoices_count' => $unclosedInvoices->count(),
                    'total_cash' => $cash,
                    'total_mobile' => $mobile,
                    'total_insured' => $insured,
                    'status' => 'closed',
                    'closed_at' => now()
                ]);

                Invoice::whereIn('id', $unclosedInvoices->pluck('id'))
                    ->update(['cashier_session_id' => $session->id]);
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Caisse clôturée avec succès. Journal ' . $session->reference . ' archivé.',
                'total_encaisse' => $session->closing_amount,
                'session' => $session
            ]);
        });
    }

    public function exportAccountingData(Request $request)
    {
        $period = $request->query('period', 'day');
        $history = $this->getHistory(new Request(['period' => $period, 'all' => true]))->getData(true);
        $rows = collect($history['invoices'] ?? [])->map(function ($invoice) {
            return [
                'id' => $invoice['id'],
                'date' => $invoice['updated_at'] ?? $invoice['created_at'],
                'patient' => trim(($invoice['patient']['first_name'] ?? '') . ' ' . ($invoice['patient']['last_name'] ?? '')),
                'service' => $invoice['service'] ?? '',
                'amount' => $invoice['amount'] ?? 0,
                'currency' => $invoice['payment_currency'] ?? 'CDF',
                'method' => $invoice['payment_method'] ?? 'cash',
                'reference' => $invoice['payment_reference'] ?? '',
            ];
        })->values();

        if ($request->query('download') === '1') {
            $csv = "ID,Date,Patient,Service,Montant,Devise,Methode,Reference\n";
            foreach ($rows as $row) {
                $csv .= collect($row)->map(fn ($value) => '"' . str_replace('"', '""', (string) $value) . '"')->implode(',') . "\n";
            }

            return response($csv, 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename=rapport-comptable-' . now()->format('Ymd-His') . '.csv',
            ]);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Le rapport comptable réel a été généré.',
            'period' => $period,
            'summary' => [
                'total' => $history['total'] ?? 0,
                'count' => $history['count'] ?? 0,
                'by_service' => $history['by_service'] ?? [],
            ],
            'rows' => $rows,
        ]);
    }
}

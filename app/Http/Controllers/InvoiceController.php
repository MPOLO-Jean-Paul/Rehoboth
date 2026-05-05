<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\Visit;
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
        $isActive = $insurance->status === 'active';

        return response()->json([
            'success' => $isActive,
            'status' => $insurance->status,
            'company' => $insurance->name,
            'message' => $isActive 
                ? "Le contrat avec {$insurance->name} est actif. Vous pouvez procéder à la prise en charge." 
                : "Le contrat avec {$insurance->name} est actuellement " . ($insurance->status === 'suspended' ? 'suspendu' : 'rompu') . "."
        ]);
    }

    public function index(Request $request)
    {
        $this->performAutoJournalCheck();
        $invoices = Invoice::with(['patient.insurance', 'visit'])
            ->whereIn('status', ['unpaid', 'insurance_billed'])
            ->orderBy('created_at', 'desc')
            ->get();
            
        return response()->json($invoices);
    }

    public function pay(Request $request, $id)
    {
        $request->validate([
            'payment_method' => 'required|string',
            'payment_phone' => 'nullable|string',
        ]);

        return DB::transaction(function () use ($request, $id) {
            $invoice = Invoice::with('visit')->lockForUpdate()->findOrFail($id);

            if ($invoice->status === 'paid') {
                return response()->json([
                    'message' => 'Cette facture est déjà payée.',
                    'invoice' => $invoice
                ], 409);
            }

            // Vérification de l'état du contrat d'assurance si paiement par assurance
            if ($request->payment_method === 'insurance' && $invoice->patient && $invoice->patient->insurance) {
                if ($invoice->patient->insurance->status !== 'active') {
                    $statusLabel = match($invoice->patient->insurance->status) {
                        'suspended' => 'suspendu (Arrêté)',
                        'terminated' => 'rompu (Terminé)',
                        default => 'inactif'
                    };
                    return response()->json([
                        'message' => "Le contrat de l'assurance {$invoice->patient->insurance->name} est actuellement {$statusLabel}. Le paiement ne peut pas être validé au nom de la société."
                    ], 403);
                }
            }

            $invoice->status = 'paid';
            $invoice->payment_method = $request->payment_method;
            $invoice->payment_phone = $request->payment_phone;

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
                'invoice' => $invoice
            ]);
        });
    }

    public function getHistory(Request $request)
    {
        $period = $request->query('period', 'day');
        $query = Invoice::with(['patient', 'visit'])->where('status', 'paid');
        
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

        $invoices = $query->orderBy('created_at', 'desc')->get();
        
        $total = $invoices->sum('amount');
        $count = $invoices->count();

        return response()->json([
            'invoices' => $invoices,
            'total' => $total,
            'count' => $count,
            'by_service' => $this->groupPaidInvoicesByService($invoices)
        ]);
    }

    public function getDailySummary()
    {
        $today = now()->startOfDay();
        $yesterday = now()->subDay()->startOfDay();
        
        $todayInvoices = Invoice::whereDate('created_at', $today)->where('status', 'paid')->get();
        $yesterdayTotal = Invoice::whereDate('created_at', $yesterday)->where('status', 'paid')->sum('amount');
        $todayTotal = $todayInvoices->sum('amount');
        
        $growth = $yesterdayTotal > 0 ? (($todayTotal - $yesterdayTotal) / $yesterdayTotal) * 100 : 0;

        $thisWeekTotal = Invoice::whereBetween('created_at', [now()->startOfWeek(), now()->endOfWeek()])->where('status', 'paid')->sum('amount');
        $lastWeekTotal = Invoice::whereBetween('created_at', [now()->subWeek()->startOfWeek(), now()->subWeek()->endOfWeek()])->where('status', 'paid')->sum('amount');
        $weekGrowth = $lastWeekTotal > 0 ? (($thisWeekTotal - $lastWeekTotal) / $lastWeekTotal) * 100 : 0;

        return response()->json([
            'today' => [
                'total' => (int) $todayTotal,
                'count' => $todayInvoices->count(),
                'growth' => round($growth, 1)
            ],
            'week' => [
                'total' => (int) $thisWeekTotal,
                'growth' => round($weekGrowth, 1)
            ],
            'by_service' => $this->groupPaidInvoicesByService($todayInvoices)
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
                'caisse'    => 'Encaissements Directs',
                'consultation' => 'Consultations Médicales'
            ];
            return [
                'service' => $serviceNames[strtolower($service)] ?? ucfirst($service),
                'total' => (int) $group->sum('amount')
            ];
        })->values();
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

        $paidInvoices = (clone $query)->where('status', 'paid')
            ->whereNull('cashier_session_id') // Balance de la session en cours uniquement
            ->get();
        
        $insuredTotal = $paidInvoices->whereNotNull('insurance_id')->sum('amount');
        $privateTotal = $paidInvoices->whereNull('insurance_id')->sum('amount');
        
        return response()->json([
            'insured' => $insuredTotal,
            'private' => $privateTotal,
            'total'   => $insuredTotal + $privateTotal,
            'count'   => $paidInvoices->count()
        ]);
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
        // Simulation d'exportation PDF/Excel
        return response()->json([
            'status' => 'success',
            'message' => 'Le rapport comptable a été généré et envoyé vers l\'imprimante/e-mail.',
            'download_url' => '#'
        ]);
    }
}

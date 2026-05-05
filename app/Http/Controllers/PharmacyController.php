<?php

namespace App\Http\Controllers;

use App\Models\Medicine;
use App\Models\StockMovement;
use App\Models\Visit;
use App\Traits\NotifiesUsers;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\DB;

class PharmacyController extends Controller
{
    use NotifiesUsers;
    public function indexMedicines()
    {
        return response()->json(Medicine::orderBy('name')->get());
    }

    public function addStock(Request $request)
    {
        $data = $request->validate([
            'medicine_id' => 'required|exists:medicines,id',
            'quantity' => 'required|integer|min:1',
            'expiry_date' => 'nullable|date',
            'low_stock_threshold' => 'nullable|integer|min:0',
            'reason' => 'nullable|string'
        ]);

        DB::transaction(function () use ($data, $request) {
            $medicine = Medicine::whereKey($data['medicine_id'])->lockForUpdate()->firstOrFail();
            $medicine->increment('stock_quantity', $data['quantity']);
            
            if (!empty($data['expiry_date'])) {
                $medicine->expiry_date = $data['expiry_date'];
            }
            if (isset($data['low_stock_threshold'])) {
                $medicine->low_stock_threshold = $data['low_stock_threshold'];
            }
            $medicine->save();

            StockMovement::create([
                'medicine_id' => $data['medicine_id'],
                'type' => 'in',
                'quantity' => $data['quantity'],
                'reason' => $data['reason'] ?? 'Approvisionnement manuel',
                'user_id' => $request->user()->id
            ]);

            // Alerte si la date de péremption est proche
            if ($medicine->expiry_date && now()->diffInDays($medicine->expiry_date, false) < 60) {
                $this->notifyPharmacyAlert("⚠️ Produit bientôt périmé", "Le produit {$medicine->name} ajouté va expirer dans moins de 60 jours ({$medicine->expiry_date}).");
            }
        });

        return response()->json(['message' => 'Stock mis à jour avec succès.']);
    }

    public function createMedicine(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|unique:medicines',
            'description' => 'nullable|string',
            'dosage' => 'nullable|string',
            'unit' => 'nullable|string',
            'price' => 'nullable|numeric|min:0',
            'low_stock_threshold' => 'nullable|integer|min:0'
        ]);

        $medicine = Medicine::create($data);

        // Sync with WorkflowSettings (Admin Catalog)
        $catalogJson = \App\Models\Setting::getValue('other_prices_catalog', '[]');
        $catalog = json_decode($catalogJson, true) ?? [];
        $catalog[] = [
            'id' => uniqid('other_'),
            'type' => 'Produit',
            'label' => $medicine->name,
            'price' => $medicine->price,
            'dosage' => $medicine->dosage,
            'locked' => false
        ];
        \App\Models\Setting::setValue('other_prices_catalog', json_encode($catalog));

        return response()->json(['message' => 'Médicament ajouté au catalogue', 'medicine' => $medicine], 201);
    }

    public function getPendingPrescriptions()
    {
        $prescriptions = \App\Models\Prescription::with(['patient.insurance', 'doctor', 'items.medicine'])
            ->where('status', 'pending')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function($p) {
                return [
                    'id' => $p->visit_id, // Identifiant de visite pour compatibilité UI
                    'prescription_id' => $p->id,
                    'patient' => $p->patient,
                    'doctor' => $p->doctor?->name,
                    'items' => $p->items->map(function($item) {
                        return [
                            'medicine_id' => $item->medicine_id,
                            'name' => $item->medicine_name,
                            'dosage' => $item->dosage,
                            'quantity' => $item->quantity_prescribed,
                            'instructions' => $item->instructions,
                            'status' => $item->status, 
                            'available_stock' => $item->medicine?->stock_quantity ?? 0,
                            'price' => $item->medicine?->price ?? 0
                        ];
                    }),
                    'notes' => $p->notes,
                    'date' => $p->created_at->format('d/m/Y H:i'),
                    'is_insured' => $p->patient?->is_insured ?? false,
                    'insurance_name' => $p->patient?->insurance?->name
                ];
            });
            
        return response()->json($prescriptions);
    }

    public function dispense(Request $request, $visitId)
    {
        $data = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.medicine_id' => 'required|exists:medicines,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.price' => 'nullable|numeric|min:0',
            'items.*.dosage' => 'nullable|string',
            'items.*.instructions' => 'nullable|string',
            'payment_mode' => 'nullable|string|in:cash,insurance',
        ]);

        DB::transaction(function () use ($data, $visitId, $request) {
            $visit = Visit::with('patient')->lockForUpdate()->findOrFail($visitId);
            $totalAmount = 0;
            $dispensedItems = [];

            foreach ($data['items'] as $item) {
                $medicine = Medicine::whereKey($item['medicine_id'])->lockForUpdate()->firstOrFail();
                
                if ($medicine->stock_quantity < $item['quantity']) {
                    throw ValidationException::withMessages([
                        'items' => "Stock insuffisant pour {$medicine->name}. Disponible: {$medicine->stock_quantity}"
                    ]);
                }

                $unitPrice = array_key_exists('price', $item) && $item['price'] !== null
                    ? (float) $item['price']
                    : (float) $medicine->price;

                $medicine->decrement('stock_quantity', $item['quantity']);
                $totalAmount += $unitPrice * $item['quantity'];

                $dispensedItems[] = [
                    'id' => $medicine->id,
                    'name' => $medicine->name,
                    'quantity' => $item['quantity'],
                    'price' => $unitPrice,
                    'total' => $unitPrice * $item['quantity'],
                    'dosage' => $item['dosage'] ?? $medicine->dosage,
                    'instructions' => $item['instructions'] ?? '',
                ];

                StockMovement::create([
                    'medicine_id' => $medicine->id,
                    'type' => 'out',
                    'quantity' => $item['quantity'],
                    'reason' => "Vente ordonnance #{$visit->id}",
                    'user_id' => $request->user()->id
                ]);

                // Auto-alert if stock falls below threshold
                if ($medicine->stock_quantity <= $medicine->low_stock_threshold) {
                    $level = $medicine->stock_quantity <= 2 ? 'CRITIQUE' : 'BAS';
                    $this->notifyPharmacyAlert(
                        "⚠️ STOCK {$level} : {$medicine->name}",
                        "Le stock de {$medicine->name} est maintenant à {$medicine->stock_quantity} unités."
                    );
                }
            }

            $isInsurance = ($data['payment_mode'] ?? null) === 'insurance' || ($visit->patient && $visit->patient->is_insured);

            // Check if an invoice was already auto-generated by the VisitController
            $existingInvoice = \App\Models\Invoice::where('visit_id', $visit->id)
                ->where('service', 'pharmacie')
                ->where('status', $isInsurance ? 'insurance_billed' : 'unpaid')
                ->lockForUpdate()
                ->first();

            if (!$existingInvoice) {
                // Create Invoice only if it doesn't exist
                \App\Models\Invoice::create([
                    'visit_id' => $visit->id,
                    'patient_id' => $visit->patient_id,
                    'insurance_id' => $isInsurance ? $visit->patient->insurance_id : null,
                    'amount' => $totalAmount,
                    'status' => $isInsurance ? 'insurance_billed' : 'unpaid',
                    'details' => 'Pharmacie: ' . count($dispensedItems) . ' produits',
                    'service' => 'pharmacie',
                    'item_count' => count($dispensedItems),
                    'metadata' => ['items' => $dispensedItems],
                ]);
            } else {
                // Optionally update metadata if items changed significantly, 
                // but usually auto-billing is considered final unless pharmacist manually adds more.
                // For now, we trust the auto-billing or the manual items passed here.
                if (count($dispensedItems) > 0) {
                    $existingInvoice->amount = $totalAmount;
                    $existingInvoice->metadata = ['items' => $dispensedItems];
                    $existingInvoice->item_count = count($dispensedItems);
                    $existingInvoice->save();
                }
            }

            // Mark visit as completed at pharmacy
            $visit->pharmacy_order_status = 'dispensed';
            $visit->current_service = 'completed';
            $visit->status = 'completed';
            $visit->save();

            // NEW: Update structured Prescription and Items
            $prescription = \App\Models\Prescription::where('visit_id', $visit->id)->where('status', 'pending')->first();
            if ($prescription) {
                $prescription->status = 'dispensed';
                $prescription->save();
                
                foreach ($data['items'] as $item) {
                    $pItem = $prescription->items()
                        ->where('medicine_id', $item['medicine_id'])
                        ->where('status', '!=', 'dispensed')
                        ->first();
                    
                    if ($pItem) {
                        $pItem->quantity_dispensed = $item['quantity'];
                        $pItem->status = 'dispensed';
                        $pItem->save();
                    }
                }
            }
        });

        return response()->json(['message' => 'Ordonnance délivrée, stock mis à jour et facture générée.']);
    }

    public function expiryStatus()
    {
        $soon = now()->addDays(30);

        $expiring = Medicine::whereNotNull('expiry_date')
            ->whereDate('expiry_date', '>', now())
            ->whereDate('expiry_date', '<=', $soon)
            ->orderBy('expiry_date')
            ->get();

        $expired = Medicine::whereNotNull('expiry_date')
            ->whereDate('expiry_date', '<=', now())
            ->orderBy('expiry_date')
            ->get();

        return response()->json([
            'expiring' => $expiring,
            'expired' => $expired
        ]);
    }

    public function dispensedToday()
    {
        $today = now()->startOfDay();

        $invoices = \App\Models\Invoice::with('patient')
            ->whereDate('created_at', $today)
            ->where('service', 'pharmacie')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($invoice) {
                return [
                    'id' => $invoice->id,
                    'patient' => $invoice->patient,
                    'total' => $invoice->amount,
                    'created_at' => $invoice->created_at,
                    'items' => $invoice->metadata['items'] ?? []
                ];
            });

        return response()->json($invoices);
    }

    public function reportProblem(Request $request)
    {
        $validated = $request->validate([
            'type' => 'required|string|in:rupture,peremption',
            'medicine_id' => 'required|exists:medicines,id',
            'message' => 'nullable|string'
        ]);

        $medicine = \App\Models\Medicine::find($validated['medicine_id']);
        $typeLabel = $validated['type'] === 'rupture' ? 'RUPTURE DE STOCK' : 'PÉREMPTION SIGNALÉE';
        
        $title = "🚨 URGENCE PHARMACIE : " . $typeLabel;
        $body = "Le pharmacien signale une " . strtolower($typeLabel) . " pour : " . $medicine->name . ". " . ($validated['message'] ?? '');

        // Log the message in staff messages as well
        \App\Models\StaffMessage::create([
            'sender_id' => $request->user()->id,
            'subject' => $typeLabel,
            'message' => $body,
            'is_read' => false
        ]);

        // Send push notification to admins
        $admins = \App\Models\User::where('role', 'admin')
            ->whereNotNull('expo_push_token')
            ->get();

        if ($admins->isNotEmpty()) {
            $tokens = $admins->pluck('expo_push_token')->toArray();
            \App\Services\ExpoNotificationService::send($tokens, $title, $body, [
                'type' => 'emergency',
                'problem_type' => $validated['type'],
                'medicine_id' => $medicine->id
            ], 'high');
        }

        return response()->json(['message' => 'Alerte envoyée aux administrateurs.']);
    }

    public function inventoryInsights(Request $request)
    {
        $days = 30;
        $startDate = now()->subDays($days);
        
        // Get all medicines
        $medicines = Medicine::all();
        
        // Get sales volume per medicine in the last X days
        $sales = DB::table('invoices')
            ->where('service', 'pharmacie')
            ->where('created_at', '>=', $startDate)
            ->get()
            ->flatMap(function($invoice) {
                $metadata = json_decode($invoice->metadata, true);
                return $metadata['items'] ?? [];
            })
            ->groupBy('id')
            ->map(function($items) {
                return collect($items)->sum('quantity');
            });

        $insights = $medicines->map(function($m) use ($sales) {
            $volume = $sales->get($m->id, 0);
            $status = 'normal';
            
            if ($volume >= 50) { // arbitrary threshold for fast moving
                $status = 'fast_moving';
            } elseif ($volume <= 2 && $m->created_at < now()->subDays(15)) { // slow moving if very few sales and exists for a while
                $status = 'slow_moving';
            }

            return [
                'id' => $m->id,
                'name' => $m->name,
                'stock' => $m->stock_quantity,
                'threshold' => $m->low_stock_threshold,
                'volume_30d' => $volume,
                'status' => $status,
                'needs_renewal' => $m->stock_quantity <= $m->low_stock_threshold,
                'is_critical' => $m->stock_quantity <= ($m->low_stock_threshold / 2)
            ];
        });

        return response()->json([
            'period_days' => $days,
            'fast_movers' => $insights->where('status', 'fast_moving')->values(),
            'slow_movers' => $insights->where('status', 'slow_moving')->values(),
            'to_renew' => $insights->where('needs_renewal', true)->sortBy('stock')->values(),
            'all' => $insights->values()
        ]);
    }

    public function salesReport(Request $request)
    {
        $period = $request->query('period', 'day'); // day, week, month
        
        $query = \App\Models\Invoice::with('patient')
            ->where('service', 'pharmacie')
            ->whereNotNull('metadata'); // invoices with metadata items

        $startDate = now();
        $endDate = now();

        if ($period === 'day') {
            $startDate = now()->startOfDay();
            // Force current month
            if ($startDate->month !== now()->month) {
                $startDate = now()->startOfMonth();
            }
        } elseif ($period === 'week') {
            $startDate = now()->startOfWeek();
            // Force current month boundary
            if ($startDate->month !== now()->month) {
                $startDate = now()->startOfMonth();
            }
        } elseif ($period === 'month') {
            $startDate = now()->startOfMonth();
        } elseif ($period === 'semester') {
            $startDate = now()->month >= 7 ? now()->month(7)->startOfMonth() : now()->month(1)->startOfMonth();
            $endDate = now()->month >= 7 ? now()->month(12)->endOfMonth() : now()->month(6)->endOfMonth();
        } elseif ($period === 'year') {
            $startDate = now()->startOfYear();
        }

        if ($period === 'semester') {
            $query->whereBetween('created_at', [$startDate, $endDate]);
        } else {
            $query->whereBetween('created_at', [$startDate, now()->endOfDay()]);
        }

        $invoices = $query->orderBy('created_at', 'desc')->get();

        $totalRevenue = $invoices->sum('amount');
        $itemsSold = [];

        foreach ($invoices as $invoice) {
            $items = $invoice->metadata['items'] ?? [];
            foreach ($items as $item) {
                $id = $item['medicine_id'] ?? null;
                if (!$id) continue;
                
                if (!isset($itemsSold[$id])) {
                    $itemsSold[$id] = [
                        'id' => $id,
                        'name' => $item['name'] ?? 'Inconnu',
                        'quantity' => 0,
                        'revenue' => 0
                    ];
                }
                $itemsSold[$id]['quantity'] += (int)$item['quantity'];
                $itemsSold[$id]['revenue'] += ((int)$item['quantity'] * (float)($item['price'] ?? 0));
            }
        }

        usort($itemsSold, function($a, $b) {
            return $b['quantity'] <=> $a['quantity']; // sort by quantity desc
        });

        return response()->json([
            'total_revenue' => $totalRevenue,
            'total_invoices' => $invoices->count(),
            'items_sold' => array_values($itemsSold),
            'invoices' => $invoices->map(function($inv) {
                return [
                    'id' => $inv->id,
                    'patient' => $inv->patient,
                    'amount' => $inv->amount,
                    'payment_method' => $inv->payment_method,
                    'created_at' => $inv->created_at,
                ];
            })
        ]);
    }

    public function cancelPrescription(Request $request, $visitId)
    {
        $user = $request->user();
        
        return DB::transaction(function () use ($visitId, $user) {
            $visit = Visit::findOrFail($visitId);
            
            // Find the active pending prescription
            $prescription = \App\Models\Prescription::where('visit_id', $visitId)
                ->where('status', 'pending')
                ->with('items')
                ->first();

            if (!$prescription) {
                return response()->json(['message' => 'Aucune ordonnance en attente trouvée.'], 404);
            }

            // Revert stock for reserved pending items
            foreach ($prescription->items as $item) {
                if ($item->medicine_id && in_array($item->status, ['pending', 'billed'], true)) {
                    $medicine = Medicine::find($item->medicine_id);
                    if ($medicine) {
                        $medicine->increment('stock_quantity', $item->quantity_prescribed);
                        StockMovement::create([
                            'medicine_id' => $medicine->id,
                            'type' => 'in',
                            'quantity' => $item->quantity_prescribed,
                            'reason' => "Annulation pharmacie (Ordonnance #{$visitId})",
                            'user_id' => $user->id
                        ]);
                    }
                }
            }

            // Delete existing invoice
            \App\Models\Invoice::where('visit_id', $visitId)
                ->where('service', 'pharmacie')
                ->whereIn('status', ['unpaid', 'insurance_billed'])
                ->delete();

            // Update prescription status
            $prescription->status = 'cancelled';
            $prescription->save();

            // Reset visit pharmacy status
            $visit->pharmacy_order_status = null;
            $visit->current_service = 'completed'; // or return to previous? Let's say completed for now
            $visit->status = 'completed';
            $visit->save();

            return response()->json(['message' => 'Ordonnance annulée et stock restitué.']);
        });
    }

    public function sendDailyReport(Request $request)
    {
        $today = now()->startOfDay();
        $invoices = \App\Models\Invoice::where('service', 'pharmacie')
            ->whereDate('created_at', $today)
            ->where('status', 'paid')
            ->get();

        $totalRevenue = $invoices->sum('amount');
        $invoiceCount = $invoices->count();
        $itemsCount = 0;

        foreach ($invoices as $inv) {
            $itemsCount += ($inv->metadata['items'] ? count($inv->metadata['items']) : 0);
        }

        $title = "📊 RAPPORT JOURNALIER : PHARMACIE";
        $body = "Résumé de la journée :\n" .
                "• Recette totale : " . number_format($totalRevenue, 0, ',', ' ') . " FC\n" .
                "• Ventes validées : {$invoiceCount}\n" .
                "• Produits délivrés : {$itemsCount}\n" .
                "Rapport généré par : " . $request->user()->name;

        // 1. Enregistrer le message pour l'admin
        \App\Models\StaffMessage::create([
            'sender_id' => $request->user()->id,
            'target_role' => 'admin',
            'subject' => $title,
            'message' => $body,
            'priority' => 'important'
        ]);

        // 2. Notification Push aux Admins
        $this->notifyRole('admin', $title, $body, [
            'type' => 'daily_report',
            'service' => 'pharmacie',
            'revenue' => $totalRevenue
        ]);

        return response()->json([
            'message' => 'Rapport journalier envoyé à l\'administration avec succès.',
            'total' => $totalRevenue,
            'count' => $invoiceCount
        ]);
    }

    private function notifyPharmacyAlert($title, $body)
    {
        // Notifier les administrateurs
        $this->notifyRole('admin', $title, $body);
        // Notifier les pharmaciens
        $this->notifyRole('pharmacie', $title, $body);

        // Optionnel: Enregistrer aussi en message staff interne
        \App\Models\StaffMessage::create([
            'sender_id' => 1, // System
            'subject' => $title,
            'message' => $body,
            'is_read' => false
        ]);
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\Medicine;
use App\Models\StockMovement;
use App\Models\Visit;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\DB;

class PharmacyController extends Controller
{
    public function indexMedicines(Request $request)
    {
        $query = Medicine::orderBy('name');
        if ($request->has('search')) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }
        return response()->json($query->get());
    }

    public function prescriptions(Request $request)
    {
        $query = Visit::with(['patient', 'invoice'])
            ->where('current_service', 'pharmacie')
            ->where('status', '!=', 'completed');

        if ($request->has('search')) {
            $search = $request->search;
            $query->whereHas('patient', function($q) use ($search) {
                $q->where('first_name', 'like', "%$search%")
                  ->orWhere('last_name', 'like', "%$search%");
            });
        }

        return response()->json($query->latest()->get());
    }

    public function inventoryInsights()
    {
        return response()->json([
            'fast_movers' => Medicine::orderByDesc('stock_quantity')->limit(5)->get(),
            'slow_movers' => Medicine::where('stock_quantity', '>', 0)->orderBy('stock_quantity')->limit(5)->get(),
            'to_renew' => Medicine::whereRaw('stock_quantity <= low_stock_threshold')->get(),
            'all' => Medicine::all()
        ]);
    }

    public function deliveryHistory()
    {
        return response()->json(
            StockMovement::with(['medicine', 'user'])
                ->where('type', 'out')
                ->latest()
                ->limit(100)
                ->get()
        );
    }

    public function sales(Request $request)
    {
        $period = $request->query('period', 'day');
        $startDate = match($period) {
            'week' => now()->startOfWeek(),
            'month' => now()->startOfMonth(),
            default => now()->startOfDay(),
        };

        $totalRevenue = Visit::join('invoices', 'visits.id', '=', 'invoices.visit_id')
            ->where('visits.current_service', 'completed')
            ->where('invoices.status', 'paid')
            ->where('invoices.created_at', '>=', $startDate)
            ->sum('invoices.amount');

        $itemsSold = StockMovement::with('medicine')
            ->where('type', 'out')
            ->where('created_at', '>=', $startDate)
            ->selectRaw('medicine_id, sum(quantity) as total_qty')
            ->groupBy('medicine_id')
            ->get();

        return response()->json([
            'total_revenue' => $totalRevenue,
            'items_sold' => $itemsSold
        ]);
    }

    public function addStock(Request $request)
    {
        $data = $request->validate([
            'medicine_id' => 'required|exists:medicines,id',
            'quantity' => 'required|integer|min:1',
            'reason' => 'nullable|string'
        ]);

        DB::transaction(function () use ($data, $request) {
            $medicine = Medicine::find($data['medicine_id']);
            $medicine->increment('stock_quantity', $data['quantity']);

            StockMovement::create([
                'medicine_id' => $data['medicine_id'],
                'type' => 'in',
                'quantity' => $data['quantity'],
                'reason' => $data['reason'] ?? 'Approvisionnement manuel',
                'user_id' => $request->user()->id
            ]);
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
        return response()->json(['message' => 'Médicament ajouté au catalogue', 'medicine' => $medicine], 201);
    }

    public function dispense(Request $request, $visitId)
    {
        $data = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.medicine_id' => 'required|exists:medicines,id',
            'items.*.quantity' => 'required|integer|min:1',
        ]);

        DB::transaction(function () use ($data, $visitId, $request) {
            foreach ($data['items'] as $item) {
                $medicine = Medicine::find($item['medicine_id']);
                
                if ($medicine->stock_quantity < $item['quantity']) {
                    throw ValidationException::withMessages([
                        'items' => "Stock insuffisant pour " . $medicine->name,
                    ]);
                }

                $medicine->decrement('stock_quantity', $item['quantity']);

                StockMovement::create([
                    'medicine_id' => $item['medicine_id'],
                    'type' => 'out',
                    'quantity' => $item['quantity'],
                    'reason' => 'Délivrance ordonnance - Visite #' . $visitId,
                    'user_id' => $request->user()->id
                ]);
            }

            // Close the visit
            $visit = Visit::findOrFail($visitId);
            $visit->current_service = 'completed';
            $visit->status = 'completed';
            $visit->save();
        });

        return response()->json(['message' => 'Ordonnance délivrée et stock mis à jour. Patient libéré.']);
    }

    public function dispensedToday()
    {
        return response()->json([
            'count' => StockMovement::where('type', 'out')
                                    ->whereDate('created_at', now())
                                    ->distinct('reason') 
                                    ->count()
        ]);
    }
}

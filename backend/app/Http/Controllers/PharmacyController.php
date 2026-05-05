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
    public function indexMedicines()
    {
        return response()->json(Medicine::orderBy('name')->get());
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
}

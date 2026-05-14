<?php

namespace App\Http\Controllers;

use App\Models\Expense;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Traits\NotifiesUsers;

class ExpenseController extends Controller
{
    use NotifiesUsers;
    public function index(Request $request)
    {
        $limit = min(max($request->integer('limit', 200), 50), 500);
        $expenses = Expense::with('user:id,name')
            ->orderBy('expense_date', 'desc')
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get();
            
        return response()->json($expenses);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'category'       => 'required|string',
            'amount'         => 'required|numeric|min:0.01',
            'description'    => 'nullable|string',
            'payment_method' => 'nullable|string',
            'expense_date'   => 'required|date',
        ]);

        $data['recorded_by'] = $request->user()->id;

        $expense = Expense::create($data);

        return response()->json([
            'message' => 'Dépense enregistrée avec succès',
            'expense' => $expense->load('user:id,name'),
        ], 201);
    }

    /**
     * Admin summary: totals by category for a given period
     */
    public function summary(Request $request)
    {
        $period = $request->query('period', 'month');

        $from = match ($period) {
            'day'   => now()->startOfDay(),
            'week'  => now()->startOfWeek(),
            'month' => now()->startOfMonth(),
            default => now()->startOfMonth(),
        };

        $total = Expense::where('expense_date', '>=', $from->toDateString())->sum('amount');

        $byCategory = Expense::where('expense_date', '>=', $from->toDateString())
            ->selectRaw('category, SUM(amount) as total, COUNT(*) as count')
            ->groupBy('category')
            ->get();

        $recent = Expense::with('user:id,name')
            ->where('expense_date', '>=', $from->toDateString())
            ->orderBy('created_at', 'desc')
            ->limit(30)
            ->get();

        return response()->json([
            'total'       => $total,
            'by_category' => $byCategory,
            'recent'      => $recent,
            'period'      => $period,
        ]);
    }

    public function destroy($id)
    {
        $expense = Expense::findOrFail($id);
        $expense->delete();
        return response()->json(['message' => 'Dépense supprimée']);
    }
}

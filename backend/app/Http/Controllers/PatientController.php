<?php

namespace App\Http\Controllers;

use App\Models\Patient;
use App\Models\Visit;
use App\Models\Invoice;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PatientController extends Controller
{
    public function index(Request $request)
    {
        $query = Patient::query();
        if ($request->has('q')) {
            $search = $request->string('q')->toString();
            $query->where(function ($inner) use ($search) {
                $inner->where('first_name', 'like', '%' . $search . '%')
                      ->orWhere('last_name', 'like', '%' . $search . '%')
                      ->orWhere('contact_info', 'like', '%' . $search . '%');
            });
        }
        return response()->json($query->orderBy('id', 'desc')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'first_name' => 'required|string',
            'last_name' => 'required|string',
            'is_insured' => 'sometimes|boolean',
            'insurance_company' => 'nullable|string',
            'insurance_code' => 'nullable|string',
            'contact_info' => 'nullable|string',
            'complaints' => 'nullable|string',
            'consultation_fee' => 'nullable|numeric|min:0'
        ]);

        return DB::transaction(function () use ($data, $request) {
            $patientQuery = Patient::query()
                ->where('first_name', $data['first_name'])
                ->where('last_name', $data['last_name']);

            if (!empty($data['contact_info'])) {
                $patientQuery->orWhere(function ($query) use ($data) {
                    $query->where('contact_info', $data['contact_info']);
                });
            }

            $patient = $patientQuery->lockForUpdate()->first();
            $message = 'Patient existant. Nouvelle visite créée.';

            if (!$patient) {
                $patient = Patient::create($data);
                $message = 'Nouveau patient enregistré.';
            }

            $visit = Visit::create([
                'patient_id' => $patient->id,
                'current_service' => 'caisse',
                'status' => 'pending',
                'complaints_notes' => $data['complaints'] ?? '',
            ]);

            $invoice = Invoice::create([
                'visit_id' => $visit->id,
                'patient_id' => $patient->id,
                'amount' => $request->input('consultation_fee', 5000),
                'status' => ($data['is_insured'] ?? false) ? 'insurance_billed' : 'unpaid',
                'details' => 'Frais de consultation initiale',
            ]);

            return response()->json([
                'message' => $message,
                'patient' => $patient,
                'visit' => $visit,
                'invoice' => $invoice,
            ], 201);
        });
    }

    public function cashToday(Request $request)
    {
        $period = $request->query('period', 'day');
        $startDate = $period === 'month' ? now()->startOfMonth() : now()->startOfDay();

        $items = Visit::join('invoices', 'visits.id', '=', 'invoices.visit_id')
            ->selectRaw('visits.current_service as service, sum(invoices.amount) as total')
            ->where('invoices.status', 'paid')
            ->where('invoices.created_at', '>=', $startDate)
            ->groupBy('visits.current_service')
            ->get();

        return response()->json([
            'items' => $items,
            'patient_count' => Patient::where('created_at', '>=', $startDate)->count(),
            'insured_count' => Patient::where('created_at', '>=', $startDate)->where('is_insured', true)->count(),
            'private_count' => Patient::where('created_at', '>=', $startDate)->where('is_insured', false)->count(),
        ]);
    }

    public function statsToday()
    {
        $todayCount = Patient::whereDate('created_at', now())->count();
        $yesterdayCount = Patient::whereDate('created_at', now()->yesterday())->count();
        $insuredCount = Patient::whereDate('created_at', now())->where('is_insured', true)->count();
        $privateCount = Patient::whereDate('created_at', now())->where('is_insured', false)->count();

        $diff = $yesterdayCount > 0 ? (($todayCount - $yesterdayCount) / $yesterdayCount) * 100 : 0;

        return response()->json([
            'today_count' => $todayCount,
            'yesterday_count' => $yesterdayCount,
            'insured_count' => $insuredCount,
            'private_count' => $privateCount,
            'diff_percent' => round($diff, 1)
        ]);
    }

    public function getInsurances()
    {
        return response()->json(
            Patient::where('is_insured', true)
                ->whereNotNull('insurance_company')
                ->select('insurance_company as name')
                ->distinct()
                ->get()
        );
    }
}

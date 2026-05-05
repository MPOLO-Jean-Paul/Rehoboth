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
}

<?php

namespace App\Http\Controllers;

use App\Models\Hospitalization;
use App\Models\NursingReport;
use App\Models\Visit;
use App\Traits\NotifiesUsers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NursingReportController extends Controller
{
    use NotifiesUsers;

    /**
     * Liste les rapports (les plus récents en premier)
     */
    public function index(Request $request): JsonResponse
    {
        $reports = NursingReport::with('nurse')
            ->orderBy('report_date', 'desc')
            ->orderBy('created_at', 'desc')
            ->limit(30)
            ->get();

        return response()->json($reports);
    }

    /**
     * Créer / Sauvegarder un rapport de garde
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'shift_type'           => 'required|in:matin,apres-midi,nuit',
            'report_date'          => 'required|date',
            'patients_seen'        => 'required|integer|min:0',
            'transfers_done'       => 'required|integer|min:0',
            'emergencies_handled'  => 'required|integer|min:0',
            'summary'              => 'required|string|min:10',
            'patients_to_watch'    => 'nullable|array',
            'patients_to_watch.*'  => 'nullable|string',
            'incidents'            => 'nullable|array',
            'handover_notes'       => 'nullable|string',
            'status'               => 'nullable|in:draft,submitted',
        ]);

        $user = $request->user();

        $report = NursingReport::create([
            ...$validated,
            'nurse_id' => $user->id,
            'status'   => $validated['status'] ?? 'draft',
        ]);

        // Notifier admin si rapport soumis
        if ($report->status === 'submitted') {
            $shiftLabels = ['matin' => 'Matin', 'apres-midi' => 'Après-Midi', 'nuit' => 'Nuit'];
            $this->notifyRole('admin', '📋 Rapport de Garde Soumis',
                "L'infirmier(e) {$user->name} a soumis le rapport de garde de la période {$shiftLabels[$report->shift_type]} du " . $report->report_date->format('d/m/Y') . ".",
                ['report_id' => $report->id]
            );
        }

        return response()->json([
            'message' => $report->status === 'submitted' ? 'Rapport soumis avec succès.' : 'Brouillon sauvegardé.',
            'report'  => $report->load('nurse'),
        ], 201);
    }

    /**
     * Mettre à jour un rapport (ex: passer de draft à submitted)
     */
    public function update(Request $request, $id): JsonResponse
    {
        $report = NursingReport::where('nurse_id', $request->user()->id)->findOrFail($id);

        $validated = $request->validate([
            'shift_type'          => 'sometimes|in:matin,apres-midi,nuit',
            'patients_seen'       => 'sometimes|integer|min:0',
            'transfers_done'      => 'sometimes|integer|min:0',
            'emergencies_handled' => 'sometimes|integer|min:0',
            'summary'             => 'sometimes|string|min:10',
            'patients_to_watch'   => 'nullable|array',
            'incidents'           => 'nullable|array',
            'handover_notes'      => 'nullable|string',
            'status'              => 'sometimes|in:draft,submitted',
        ]);

        $report->update($validated);

        if ($report->status === 'submitted') {
            $user = $request->user();
            $this->notifyRole('admin', '📋 Rapport de Garde Soumis',
                "L'infirmier(e) {$user->name} a soumis le rapport de garde.",
                ['report_id' => $report->id]
            );
        }

        return response()->json([
            'message' => 'Rapport mis à jour.',
            'report'  => $report->fresh('nurse'),
        ]);
    }

    // ==============================================================
    // ALERTES HOSPITALISÉS
    // ==============================================================

    /**
     * Obtenir toutes les alertes actives des hospitalisés
     */
    public function getAlerts(): JsonResponse
    {
        $alerts = [];
        $now    = now();

        $active = Hospitalization::with('patient')
            ->where('status', 'active')
            ->get();

        foreach ($active as $h) {
            $patientAlerts = [];

            // Alerte 1: Pas de visite depuis plus de 6 heures
            if ($h->last_checked_at) {
                $hoursSince = $h->last_checked_at->diffInHours($now);
                if ($hoursSince >= 6) {
                    $patientAlerts[] = [
                        'type'     => 'no_check',
                        'severity' => $hoursSince >= 12 ? 'critical' : 'warning',
                        'message'  => "Aucune visite infirmière depuis {$hoursSince}h",
                    ];
                }
            } else {
                // Jamais visité
                $hoursSinceAdmission = $h->created_at->diffInHours($now);
                if ($hoursSinceAdmission >= 3) {
                    $patientAlerts[] = [
                        'type'     => 'never_checked',
                        'severity' => 'critical',
                        'message'  => "Patient jamais visité depuis l'admission",
                    ];
                }
            }

            // Alerte 2: Alerte manuelle active (déclenchée par l'infirmier)
            if ($h->alert_active) {
                $patientAlerts[] = [
                    'type'     => 'manual',
                    'severity' => 'critical',
                    'message'  => $h->alert_reason ?? 'Alerte déclenchée manuellement',
                ];
            }

            // Alerte 3: Long séjour (plus de 14 jours sans sortie prévue)
            if ($h->days_count > 14) {
                $patientAlerts[] = [
                    'type'     => 'long_stay',
                    'severity' => 'info',
                    'message'  => "Hospitalisation longue durée ({$h->days_count} jours)",
                ];
            }

            if (!empty($patientAlerts)) {
                $alerts[] = [
                    'hospitalization_id' => $h->id,
                    'patient'            => $h->patient,
                    'room_number'        => $h->room_number,
                    'ward'               => $h->ward,
                    'days_count'         => $h->days_count,
                    'last_checked_at'    => $h->last_checked_at,
                    'alerts'             => $patientAlerts,
                ];
            }
        }

        // Trier par sévérité: critical d'abord
        usort($alerts, function ($a, $b) {
            $severityOrder = ['critical' => 0, 'warning' => 1, 'info' => 2];
            $maxA = min(array_map(fn($al) => $severityOrder[$al['severity']] ?? 2, $a['alerts']));
            $maxB = min(array_map(fn($al) => $severityOrder[$al['severity']] ?? 2, $b['alerts']));
            return $maxA <=> $maxB;
        });

        return response()->json([
            'alerts'      => $alerts,
            'total'       => count($alerts),
            'critical'    => count(array_filter($alerts, fn($a) => collect($a['alerts'])->pluck('severity')->contains('critical'))),
        ]);
    }

    /**
     * Marquer un patient hospitalisé comme visité
     */
    public function markChecked(Request $request, $id): JsonResponse
    {
        $hosp = Hospitalization::findOrFail($id);
        $hosp->update([
            'last_checked_at' => now(),
            'alert_active'    => false,
            'alert_reason'    => null,
        ]);

        return response()->json(['message' => 'Visite enregistrée.', 'checked_at' => now()]);
    }

    /**
     * Déclencher ou désactiver une alerte manuelle
     */
    public function triggerAlert(Request $request, $id): JsonResponse
    {
        $validated = $request->validate([
            'active'  => 'required|boolean',
            'reason'  => 'nullable|string|max:255',
        ]);

        $hosp = Hospitalization::with('patient')->findOrFail($id);
        $hosp->update([
            'alert_active' => $validated['active'],
            'alert_reason' => $validated['active'] ? ($validated['reason'] ?? 'Alerte déclenchée') : null,
        ]);

        if ($validated['active']) {
            $this->notifyRole('admin', '🚨 Alerte Patient Hospitalisé',
                "Alerte pour {$hosp->patient->first_name} {$hosp->patient->last_name} - Chambre {$hosp->room_number}: " . ($validated['reason'] ?? 'Surveillance requise'),
                ['hospitalization_id' => $hosp->id]
            );
        }

        return response()->json([
            'message' => $validated['active'] ? 'Alerte déclenchée.' : 'Alerte désactivée.',
        ]);
    }

    /**
     * Statistiques du jour pour pré-remplir le rapport
     */
    public function todayStats(Request $request): JsonResponse
    {
        $today = now()->toDateString();

        $patientsSeen    = Visit::whereDate('updated_at', $today)->where('current_service', 'soins')->count() +
                          Visit::whereDate('updated_at', $today)->whereRaw("complaints_notes LIKE '%[SOINS]%'")->count();
        $transfersDone   = Visit::whereDate('updated_at', $today)->where('current_service', 'medecin')->whereRaw("complaints_notes LIKE '%[SOINS]%'")->count();
        $emergencies     = Visit::whereDate('updated_at', $today)->whereRaw("complaints_notes LIKE '%[URGENCE]%'")->count();
        $hospitalized    = Hospitalization::where('status', 'active')->count();
        $alerts          = Hospitalization::where('status', 'active')->where('alert_active', true)->count();

        return response()->json([
            'patients_seen'       => $patientsSeen,
            'transfers_done'      => $transfersDone,
            'emergencies_handled' => $emergencies,
            'hospitalized_count'  => $hospitalized,
            'active_alerts'       => $alerts,
            'date'                => $today,
        ]);
    }

    /**
     * Statistiques rapides pour le dashboard Soins
     */
    public function soinsStats(Request $request): JsonResponse
    {
        $today = now()->toDateString();
        
        // Patients actuellement aux soins
        $inCare = Visit::where('current_service', 'soins')
            ->where('status', '!=', 'completed')
            ->count();
            
        // Urgences non encore traitées
        $urgencies = Visit::where('current_service', 'soins')
            ->where('status', '!=', 'completed')
            ->where(function($q) {
                $q->where('complaints_notes', 'like', '%urgent%')
                  ->orWhere('complaints_notes', 'like', '%URGENCE%');
            })
            ->count();
            
        // Traitements terminés aujourd'hui par le service soins
        $completedToday = Visit::whereDate('updated_at', $today)
            ->where('status', 'completed')
            ->where('complaints_notes', 'like', '%[SOINS]%')
            ->count();

        return response()->json([
            'inCare' => $inCare,
            'urgencies' => $urgencies,
            'completedToday' => $completedToday,
        ]);
    }
}

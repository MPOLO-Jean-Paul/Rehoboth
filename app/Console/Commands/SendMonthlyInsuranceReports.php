<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('app:send-monthly-insurance-reports')]
#[Description('Envoie les relevés mensuels de prestations aux sociétés d\'assurance')]
class SendMonthlyInsuranceReports extends Command
{
    /**
     * Execute the console command.
     */
    public function handle()
    {
        $lastMonth = now()->subMonth();
        $periodStart = $lastMonth->copy()->startOfMonth();
        $periodEnd = $lastMonth->copy()->endOfMonth();
        $monthName = $lastMonth->translatedFormat('F Y');
        
        $insurances = \App\Models\Insurance::where('status', 'active')->whereNotNull('email')->get();
        
        if ($insurances->isEmpty()) {
            $this->info("Aucune assurance active avec email trouvée.");
            return;
        }

        foreach ($insurances as $insurance) {
            $invoices = \App\Models\Invoice::with('patient')
                ->where('insurance_id', $insurance->id)
                ->where('status', 'paid')
                ->whereBetween('updated_at', [$periodStart, $periodEnd])
                ->get();

            if ($invoices->count() > 0) {
                \Illuminate\Support\Facades\Mail::to($insurance->email)
                    ->send(new \App\Mail\MonthlyInsuranceReport($insurance, $monthName, $invoices));
                
                $this->info("Rapport envoyé à {$insurance->name} ({$insurance->email}) pour {$monthName}.");
            } else {
                $this->warn("Aucune prestation trouvée pour {$insurance->name} en {$monthName}. Rapport ignoré.");
            }
        }

        $this->info("Processus de rapports mensuels terminé.");
    }
}

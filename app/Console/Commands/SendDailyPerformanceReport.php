<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('app:send-daily-performance-report')]
#[Description('Envoie le rendement journalier aux administrateurs via notification push')]
class SendDailyPerformanceReport extends Command
{
    /**
     * Execute the console command.
     */
    public function handle()
    {
        $today = \Carbon\Carbon::today();
        
        $revenue = \App\Models\Invoice::where('status', 'paid')
            ->whereDate('created_at', $today)
            ->sum('amount');

        $patientsCount = \App\Models\Visit::whereDate('created_at', $today)->count();

        $admins = \App\Models\User::where('role', 'admin')
            ->whereNotNull('expo_push_token')
            ->get();

        if ($admins->isEmpty()) {
            $this->info('No admins with push tokens found.');
            return;
        }

        $tokens = $admins->pluck('expo_push_token')->toArray();
        $title = "📊 Rendement du Jour Disponible";
        $body = "Aujourd'hui : " . number_format($revenue, 0, ',', ' ') . " FC pour " . $patientsCount . " visites. Cliquez pour voir les détails.";

        $success = \App\Services\ExpoNotificationService::send($tokens, $title, $body, [
            'type' => 'daily_report',
            'date' => $today->toDateString()
        ]);

        if ($success) {
            $this->info('Daily performance report sent successfully.');
        } else {
            $this->error('Failed to send daily performance report.');
        }
    }
}

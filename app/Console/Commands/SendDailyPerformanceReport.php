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
        $tomorrow = $today->copy()->addDay();
        
        // 💰 Revenue
        $revenue = \App\Models\Invoice::where('status', 'paid')
            ->where('created_at', '>=', $today)
            ->where('created_at', '<', $tomorrow)
            ->sum('amount');

        // 💸 Expenses
        $expenses = \App\Models\Expense::where('expense_date', $today->toDateString())
            ->sum('amount');

        // 📈 Stats
        $patientsCount = \App\Models\Visit::where('created_at', '>=', $today)
            ->where('created_at', '<', $tomorrow)
            ->count();

        $births = \App\Models\MaternityCase::where('delivery_date', '>=', $today)
            ->where('delivery_date', '<', $tomorrow)
            ->count();

        $net = $revenue - $expenses;

        $admins = \App\Models\User::where('role', 'admin')
            ->whereNotNull('expo_push_token')
            ->get();

        if ($admins->isEmpty()) {
            $this->info('No admins with push tokens found.');
            return;
        }

        $tokens = $admins->pluck('expo_push_token')->toArray();
        $title = "📊 RÉSUMÉ DU JOUR : " . $today->format('d/m/Y');
        
        $body = "💰 Recettes : " . number_format($revenue, 0, ',', ' ') . " FC\n" .
                "💸 Dépenses : " . number_format($expenses, 0, ',', ' ') . " FC\n" .
                "⚖️ Solde : " . number_format($net, 0, ',', ' ') . " FC\n" .
                "👥 Visites : " . $patientsCount . ($births > 0 ? " | 👶 Naissances : " . $births : "");

        $success = \App\Services\ExpoNotificationService::send($tokens, $title, $body, [
            'type' => 'daily_report',
            'date' => $today->toDateString(),
            'revenue' => $revenue,
            'expenses' => $expenses,
            'net' => $net
        ]);

        if ($success) {
            $this->info('Daily performance report sent successfully.');
        } else {
            $this->error('Failed to send daily performance report.');
        }
    }
}

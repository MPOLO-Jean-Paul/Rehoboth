<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('visits', function (Blueprint $table) {
            if (!Schema::hasColumn('visits', 'vitals')) {
                $table->json('vitals')->nullable()->after('diagnosis');
            }
            if (!Schema::hasColumn('visits', 'nursing_notes')) {
                $table->text('nursing_notes')->nullable()->after('vitals');
            }
            if (!Schema::hasColumn('visits', 'consultation_notes')) {
                $table->text('consultation_notes')->nullable()->after('nursing_notes');
            }
            if (!Schema::hasColumn('visits', 'prescription_notes')) {
                $table->text('prescription_notes')->nullable()->after('consultation_notes');
            }
            if (!Schema::hasColumn('visits', 'prescription_items')) {
                $table->json('prescription_items')->nullable()->after('prescription_notes');
            }
            if (!Schema::hasColumn('visits', 'lab_tests')) {
                $table->json('lab_tests')->nullable()->after('prescription_items');
            }
            if (!Schema::hasColumn('visits', 'lab_results')) {
                $table->text('lab_results')->nullable()->after('lab_tests');
            }
            if (!Schema::hasColumn('visits', 'lab_order_status')) {
                $table->string('lab_order_status')->default('none')->after('lab_results');
            }
            if (!Schema::hasColumn('visits', 'pharmacy_order_status')) {
                $table->string('pharmacy_order_status')->default('none')->after('lab_order_status');
            }
        });

        Schema::table('invoices', function (Blueprint $table) {
            if (!Schema::hasColumn('invoices', 'item_count')) {
                $table->integer('item_count')->nullable()->after('service');
            }
            if (!Schema::hasColumn('invoices', 'metadata')) {
                $table->json('metadata')->nullable()->after('item_count');
            }
        });
    }

    public function down(): void
    {
        Schema::table('visits', function (Blueprint $table) {
            $drops = [];
            foreach ([
                'vitals',
                'nursing_notes',
                'consultation_notes',
                'prescription_notes',
                'prescription_items',
                'lab_tests',
                'lab_results',
                'lab_order_status',
                'pharmacy_order_status',
            ] as $column) {
                if (Schema::hasColumn('visits', $column)) {
                    $drops[] = $column;
                }
            }
            if ($drops) {
                $table->dropColumn($drops);
            }
        });

        Schema::table('invoices', function (Blueprint $table) {
            $drops = [];
            foreach (['item_count', 'metadata'] as $column) {
                if (Schema::hasColumn('invoices', $column)) {
                    $drops[] = $column;
                }
            }
            if ($drops) {
                $table->dropColumn($drops);
            }
        });
    }
};

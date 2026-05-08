<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('staff_messages', function (Blueprint $table) {
            // target_role is already indexed in 2026_05_02_220000
            $table->index('created_at');
        });

        Schema::table('staff_message_reads', function (Blueprint $table) {
            $table->index(['staff_message_id', 'user_id'], 'sm_user_idx');
            $table->index('deleted_at');
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->index(['user_id', 'role']);
            $table->index('created_at');
        });

        Schema::table('visits', function (Blueprint $table) {
            $table->index('patient_id');
            $table->index('status');
            $table->index('current_service');
            $table->index('created_at');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->index('visit_id');
            $table->index('patient_id');
            $table->index('status');
            $table->index('service');
            $table->index('created_at');
        });

        Schema::table('patients', function (Blueprint $table) {
            $table->index('first_name');
            $table->index('last_name');
            $table->index('contact_info');
            $table->index('insurance_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('staff_messages', function (Blueprint $table) {
            $table->dropIndex(['created_at']);
        });

        Schema::table('staff_message_reads', function (Blueprint $table) {
            $table->dropIndex('sm_user_idx');
            $table->dropIndex(['deleted_at']);
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'role']);
            $table->dropIndex(['created_at']);
        });

        Schema::table('visits', function (Blueprint $table) {
            $table->dropIndex(['patient_id']);
            $table->dropIndex(['status']);
            $table->dropIndex(['current_service']);
            $table->dropIndex(['created_at']);
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropIndex(['visit_id']);
            $table->dropIndex(['patient_id']);
            $table->dropIndex(['status']);
            $table->dropIndex(['service']);
            $table->dropIndex(['created_at']);
        });

        Schema::table('patients', function (Blueprint $table) {
            $table->dropIndex(['first_name']);
            $table->dropIndex(['last_name']);
            $table->dropIndex(['contact_info']);
            $table->dropIndex(['insurance_id']);
        });
    }
};

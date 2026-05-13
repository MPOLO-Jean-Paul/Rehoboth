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
        Schema::table('invoices', function (Blueprint $table) {
            $table->index(['status', 'created_at'], 'invoices_status_created_idx');
            $table->index(['insurance_id', 'status', 'created_at'], 'invoices_insurance_status_created_idx');
            $table->index(['insurance_id', 'status', 'updated_at'], 'invoices_insurance_status_updated_idx');
            $table->index(['service', 'status', 'created_at'], 'invoices_service_status_created_idx');
            $table->index(['cashier_session_id', 'status', 'created_at'], 'invoices_session_status_created_idx');
        });

        Schema::table('visits', function (Blueprint $table) {
            $table->index(['current_service', 'status', 'created_at'], 'visits_service_status_created_idx');
            $table->index(['status', 'created_at'], 'visits_status_created_idx');
            $table->index(['current_service', 'updated_at'], 'visits_service_updated_idx');
        });

        Schema::table('patients', function (Blueprint $table) {
            $table->index(['created_at'], 'patients_created_idx');
            $table->index(['is_insured', 'created_at'], 'patients_insured_created_idx');
        });

        Schema::table('cashier_sessions', function (Blueprint $table) {
            $table->index(['status', 'created_at'], 'cashier_sessions_status_created_idx');
        });

        Schema::table('insurances', function (Blueprint $table) {
            $table->index(['status', 'name'], 'insurances_status_name_idx');
        });

        Schema::table('medicines', function (Blueprint $table) {
            $table->index(['expiry_date'], 'medicines_expiry_idx');
        });

        Schema::table('lab_orders', function (Blueprint $table) {
            $table->index(['status', 'created_at'], 'lab_orders_status_created_idx');
            $table->index(['visit_id', 'status'], 'lab_orders_visit_status_idx');
        });

        Schema::table('prescriptions', function (Blueprint $table) {
            $table->index(['status', 'created_at'], 'prescriptions_status_created_idx');
            $table->index(['visit_id', 'status'], 'prescriptions_visit_status_idx');
        });

        Schema::table('prescription_items', function (Blueprint $table) {
            $table->index(['medicine_id', 'status'], 'prescription_items_medicine_status_idx');
        });

        Schema::table('hospitalizations', function (Blueprint $table) {
            $table->index(['status', 'admission_date'], 'hospitalizations_status_admission_idx');
            $table->index(['status', 'ward'], 'hospitalizations_status_ward_idx');
            $table->index(['last_checked_at'], 'hospitalizations_last_checked_idx');
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->index(['user_id', 'is_read', 'created_at'], 'notifications_user_read_created_idx');
            $table->index(['role', 'is_read', 'created_at'], 'notifications_role_read_created_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropIndex('invoices_status_created_idx');
            $table->dropIndex('invoices_insurance_status_created_idx');
            $table->dropIndex('invoices_insurance_status_updated_idx');
            $table->dropIndex('invoices_service_status_created_idx');
            $table->dropIndex('invoices_session_status_created_idx');
        });

        Schema::table('visits', function (Blueprint $table) {
            $table->dropIndex('visits_service_status_created_idx');
            $table->dropIndex('visits_status_created_idx');
            $table->dropIndex('visits_service_updated_idx');
        });

        Schema::table('patients', function (Blueprint $table) {
            $table->dropIndex('patients_created_idx');
            $table->dropIndex('patients_insured_created_idx');
        });

        Schema::table('cashier_sessions', function (Blueprint $table) {
            $table->dropIndex('cashier_sessions_status_created_idx');
        });

        Schema::table('insurances', function (Blueprint $table) {
            $table->dropIndex('insurances_status_name_idx');
        });

        Schema::table('medicines', function (Blueprint $table) {
            $table->dropIndex('medicines_expiry_idx');
        });

        Schema::table('lab_orders', function (Blueprint $table) {
            $table->dropIndex('lab_orders_status_created_idx');
            $table->dropIndex('lab_orders_visit_status_idx');
        });

        Schema::table('prescriptions', function (Blueprint $table) {
            $table->dropIndex('prescriptions_status_created_idx');
            $table->dropIndex('prescriptions_visit_status_idx');
        });

        Schema::table('prescription_items', function (Blueprint $table) {
            $table->dropIndex('prescription_items_medicine_status_idx');
        });

        Schema::table('hospitalizations', function (Blueprint $table) {
            $table->dropIndex('hospitalizations_status_admission_idx');
            $table->dropIndex('hospitalizations_status_ward_idx');
            $table->dropIndex('hospitalizations_last_checked_idx');
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex('notifications_user_read_created_idx');
            $table->dropIndex('notifications_role_read_created_idx');
        });
    }
};

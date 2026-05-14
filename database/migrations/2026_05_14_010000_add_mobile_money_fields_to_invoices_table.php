<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->string('payment_reference')->nullable()->after('payment_phone');
            $table->string('payment_currency', 3)->default('CDF')->after('payment_reference');
            $table->string('payment_status')->nullable()->after('payment_currency');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['payment_reference', 'payment_currency', 'payment_status']);
        });
    }
};

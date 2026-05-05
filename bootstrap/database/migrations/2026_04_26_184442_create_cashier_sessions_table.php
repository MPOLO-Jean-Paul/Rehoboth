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
        Schema::create('cashier_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->decimal('opening_amount', 15, 2)->default(0);
            $table->decimal('closing_amount', 15, 2)->default(0);
            $table->integer('invoices_count')->default(0);
            $table->decimal('total_cash', 15, 2)->default(0);
            $table->decimal('total_mobile', 15, 2)->default(0);
            $table->decimal('total_insured', 15, 2)->default(0);
            $table->string('status')->default('closed'); // For simplicity, we create them as closed when doing a report
            $table->timestamp('opened_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->string('reference')->unique(); // e.g. JRN-2026-04-26
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cashier_sessions');
    }
};

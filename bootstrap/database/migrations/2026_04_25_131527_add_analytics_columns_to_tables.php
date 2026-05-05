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
        Schema::table('visits', function (Blueprint $table) {
            $table->string('diagnosis')->nullable();
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->string('service')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('visits', function (Blueprint $table) {
            $table->dropColumn('diagnosis');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn('service');
        });
    }
};

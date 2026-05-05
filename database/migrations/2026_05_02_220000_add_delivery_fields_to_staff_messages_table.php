<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('staff_messages', function (Blueprint $table) {
            $table->string('target_role')->nullable()->after('sender_id')->index();
            $table->string('priority')->default('normal')->after('message')->index();
        });
    }

    public function down(): void
    {
        Schema::table('staff_messages', function (Blueprint $table) {
            $table->dropIndex(['target_role']);
            $table->dropIndex(['priority']);
            $table->dropColumn(['target_role', 'priority']);
        });
    }
};

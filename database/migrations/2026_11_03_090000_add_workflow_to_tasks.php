<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            // "Starts after": the task waits until this one is validated (shooting → retouche → montage…).
            $table->foreignId('depends_on_id')->nullable()->after('activity_id')->constrained('tasks')->nullOnDelete();
            $table->timestamp('started_at')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropConstrainedForeignId('depends_on_id');
            $table->dropColumn('started_at');
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('penalties', function (Blueprint $table) {
            $table->string('cancel_batch', 36)->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::table('penalties', function (Blueprint $table) {
            $table->dropIndex(['cancel_batch']);
            $table->dropColumn('cancel_batch');
        });
    }
};

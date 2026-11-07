<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->date('start_date')->nullable()->after('event_date');
        });

        DB::table('projects')->orderBy('id')->each(function (object $project): void {
            $firstTaskDate = DB::table('tasks')->where('project_id', $project->id)->min('due_date');
            $startDate = $firstTaskDate ?? $project->event_date ?? substr((string) $project->created_at, 0, 10);
            DB::table('projects')->where('id', $project->id)->update(['start_date' => $startDate]);
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn('start_date');
        });
    }
};

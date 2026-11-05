<?php

namespace App\Http\Controllers;

use App\Models\Activity;
use App\Models\ActivityLog;
use App\Models\Project;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class ActivityController extends Controller
{
    public function store(Request $request, Project $project): RedirectResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:255'], 'description' => ['nullable', 'string', 'max:5000']]);
        $activity = $project->activities()->create([...$data, 'created_by' => $request->user()->id]);
        ActivityLog::record('created', "Activité « {$activity->name} » ajoutée au projet « {$project->name} »", $activity);

        return back()->with('success', 'Activité ajoutée.');
    }

    public function update(Request $request, Activity $activity): RedirectResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:255'], 'description' => ['nullable', 'string', 'max:5000']]);
        $activity->update($data);
        ActivityLog::record('updated', "Activité « {$activity->name} » modifiée", $activity);

        return back()->with('success', 'Activité mise à jour.');
    }

    public function destroy(Activity $activity): RedirectResponse
    {
        if ($activity->tasks()->whereHas('payments')->exists() || $activity->tasks()->where('status', 'done')->exists()) {
            return back()->with('error', 'Cette activité contient des tâches terminées ou payées : elle ne peut pas être supprimée.');
        }
        $activity->tasks()->delete();
        $activity->expenses()->delete();
        $activity->delete();
        ActivityLog::record('deleted', "Activité « {$activity->name} » archivée", $activity);

        return back()->with('success', 'Activité archivée.');
    }
}

<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Models\ActivityLog;
use App\Models\Project;
use App\Models\ProjectTemplate;
use App\Services\TemplateService;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controllers\HasMiddleware;
use Illuminate\Routing\Controllers\Middleware;
use Inertia\Inertia;
use Inertia\Response;

class ProjectTemplateController extends Controller implements HasMiddleware
{
    /** Templates are hidden unless FEATURE_TEMPLATES=true. */
    public static function middleware(): array
    {
        return [new Middleware(function (Request $request, Closure $next) {
            abort_unless(config('studio.templates'), 404);

            return $next($request);
        })];
    }

    public function index(): Response
    {
        return Inertia::render('templates/index', [
            'templates' => ProjectTemplate::orderBy('name')->get()->map(fn (ProjectTemplate $t) => $t->toRow()),
            'roles' => collect(Role::cases())->reject(fn ($r) => $r === Role::Assistant)->map(fn ($r) => ['value' => $r->value, 'label' => $r->label()])->values(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);
        $tpl = ProjectTemplate::create([...$data, 'created_by' => $request->user()->id]);
        ActivityLog::record('created', "Modèle de projet « {$tpl->name} » créé", $tpl);

        return back()->with('success', 'Modèle créé.');
    }

    public function update(Request $request, ProjectTemplate $template): RedirectResponse
    {
        $template->update($this->validated($request));
        ActivityLog::record('updated', "Modèle de projet « {$template->name} » modifié", $template);

        return back()->with('success', 'Modèle enregistré.');
    }

    public function destroy(ProjectTemplate $template): RedirectResponse
    {
        $template->delete();
        ActivityLog::record('deleted', "Modèle de projet « {$template->name} » supprimé", $template);

        return back()->with('success', 'Modèle supprimé. Les projets déjà créés avec ne changent pas.');
    }

    /** "Enregistrer comme modèle": reuse what worked on a real project. */
    public function fromProject(Request $request, Project $project): RedirectResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:255']], ['name.required' => 'Donnez un nom au modèle.']);
        $structure = TemplateService::fromProject($project);
        if (! $structure['activities']) {
            return back()->with('error', 'Ce projet n\'a encore aucune tâche à reprendre.');
        }
        $tpl = ProjectTemplate::create(['name' => $data['name'], 'description' => "Créé à partir du projet « {$project->name} ».", 'structure' => $structure, 'created_by' => $request->user()->id]);
        ActivityLog::record('created', "Modèle « {$tpl->name} » créé à partir du projet « {$project->name} »", $tpl);

        return back()->with('success', "Modèle « {$tpl->name} » enregistré. Retrouvez-le dans Modèles de projet.");
    }

    public function apply(Request $request, Project $project): RedirectResponse
    {
        $data = $request->validate([
            'template_id' => ['required', 'exists:project_templates,id'],
            'rows' => ['required', 'array'],
            'rows.*.key' => ['required', 'string'],
            'rows.*.include' => ['boolean'],
            'rows.*.assigned_to' => ['nullable', 'integer'],
            'rows.*.due_date' => ['nullable', 'date'],
            'skip_shares' => ['boolean'],
        ]);
        $count = TemplateService::apply($project, ProjectTemplate::findOrFail($data['template_id']), $data['rows'], $request->user(), (bool) ($data['skip_shares'] ?? false));

        return redirect("/projects/{$project->id}")->with('success', "$count tâche(s) créée(s) et assignée(s). Chacun a été prévenu.");
    }

    /** @return array<string, mixed> */
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'structure' => ['required', 'array'],
        ], ['name.required' => 'Donnez un nom au modèle.']);
        $data['structure'] = TemplateService::normalize($data['structure']);

        return $data;
    }
}

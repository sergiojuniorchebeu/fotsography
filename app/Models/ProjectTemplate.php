<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A reusable project skeleton: activities and their tasks, with the role to
 * assign, a due date relative to the event or the delivery, the pay and the
 * share of the client price, and which task each one waits for.
 *
 * @property array{activities: array<int, array{name: string, tasks: array<int, array<string, mixed>>}>} $structure
 */
class ProjectTemplate extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['structure' => 'array'];
    }

    /** @return array<int, array<string, mixed>> every task, with its activity name */
    public function tasks(): array
    {
        $out = [];
        foreach ($this->structure['activities'] ?? [] as $a) {
            foreach ($a['tasks'] ?? [] as $t) {
                $out[] = [...$t, 'activity' => $a['name']];
            }
        }

        return $out;
    }

    public function toRow(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'structure' => $this->structure,
            'tasks_count' => count($this->tasks()),
            'client_pct_total' => array_sum(array_column($this->tasks(), 'client_pct')),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}

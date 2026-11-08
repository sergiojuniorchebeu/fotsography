@php($f = fn ($n) => number_format($n, 0, ',', ' ').' FCFA')
@extends('pdf.layout')
@section('title', 'Reçu de paiement')
@section('number', $payment->receipt_number)
@section('date', 'Le '.$payment->paid_at->format('d/m/Y à H:i'))
@section('content')
<table style="width: 100%"><tr>
    <td style="width: 50%; vertical-align: top" class="box">
        <div class="muted">Reçu de</div>
        <strong>{{ $payment->client->name }}</strong><br>
        @if($payment->client->phone){{ $payment->client->phone }}<br>@endif
        @if($payment->client->address){{ $payment->client->address }}@endif
    </td>
    <td style="width: 4%"></td>
    <td style="vertical-align: top" class="box">
        <div class="muted">Projet</div>
        <strong>{{ $project->name }}</strong><br>
        @if($project->location){{ $project->location }}<br>@endif
        @if($project->event_date)Événement le {{ $project->event_date->format('d/m/Y') }}@endif
    </td>
</tr></table>

<h3>Détail du paiement</h3>
<table class="grid">
    <tr><th>Désignation</th><th>Moyen</th><th>Référence</th><th class="r">Montant</th></tr>
    <tr>
        <td>{{ $payment->type->label() }}@if($payment->note)<br><span class="muted">{{ $payment->note }}</span>@endif</td>
        <td>{{ $payment->method->label() }}</td>
        <td>{{ $payment->reference ?: '—' }}</td>
        <td class="r">{{ $f($payment->amount) }}</td>
    </tr>
    <tr class="total"><td colspan="3">Montant reçu</td><td class="r">{{ $f($payment->amount) }}</td></tr>
</table>

<h3>Situation du projet</h3>
<table class="grid">
    <tr><td>Montant total du projet</td><td class="r">{{ $f($project->total_amount) }}</td></tr>
    <tr><td>Total payé à ce jour</td><td class="r">{{ $f($paidToDate) }}</td></tr>
    <tr><td><strong>Reste à payer</strong></td><td class="r"><strong>{{ $remaining === 0 ? 'Soldé' : $f($remaining) }}</strong></td></tr>
</table>

<table class="stamp"><tr>
    <td class="muted">Enregistré par {{ $recordedBy ?? '—' }}</td>
    <td class="r">Signature et cachet<br><br><br>____________________</td>
</tr></table>
@endsection

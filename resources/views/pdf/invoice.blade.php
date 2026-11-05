@php($f = fn ($n) => number_format($n, 0, ',', ' ').' FCFA')
@extends('pdf.layout')
@section('title', 'Facture finale')
@section('number', $invoice->number)
@section('date', 'Le '.$invoice->issued_at->format('d/m/Y'))
@section('content')
<table style="width: 100%"><tr>
    <td style="width: 50%; vertical-align: top" class="box">
        <div class="muted">Facturé à</div>
        <strong>{{ $project->client->name }}</strong><br>
        @if($project->client->phone){{ $project->client->phone }}<br>@endif
        @if($project->client->email){{ $project->client->email }}<br>@endif
        @if($project->client->address){{ $project->client->address }}@endif
    </td>
    <td style="width: 4%"></td>
    <td style="vertical-align: top" class="box">
        <div class="muted">Prestation</div>
        <strong>{{ $project->name }}</strong><br>
        @if($project->location){{ $project->location }}<br>@endif
        @if($project->event_date)Événement le {{ $project->event_date->format('d/m/Y') }}<br>@endif
        Livraison le {{ $project->delivery_date->format('d/m/Y') }}
    </td>
</tr></table>

<h3>Prestations</h3>
<table class="grid">
    <tr><th>Désignation</th><th class="r">Montant</th></tr>
    @forelse($lines as $line)
        <tr><td>{{ $line->activity?->name }} — {{ $line->name }}</td><td class="r">{{ $f($line->client_share) }}</td></tr>
    @empty
        <tr><td>{{ $project->name }}</td><td class="r">{{ $f($project->total_amount) }}</td></tr>
    @endforelse
    @php($rest = $project->total_amount - $lines->sum('client_share'))
    @if($lines->isNotEmpty() && $rest > 0)
        <tr><td>Autres prestations</td><td class="r">{{ $f($rest) }}</td></tr>
    @endif
    <tr class="total"><td>Total</td><td class="r">{{ $f($project->total_amount) }}</td></tr>
</table>

<h3>Règlements reçus</h3>
<table class="grid">
    <tr><th>Reçu</th><th>Date</th><th>Tranche</th><th>Moyen</th><th class="r">Montant</th></tr>
    @foreach($payments as $p)
        <tr><td>{{ $p->receipt_number }}</td><td>{{ $p->paid_at->format('d/m/Y') }}</td><td>{{ $p->type->label() }}</td><td>{{ $p->method->label() }}</td><td class="r">{{ $f($p->amount) }}</td></tr>
    @endforeach
    <tr class="total"><td colspan="4">Total réglé</td><td class="r">{{ $f($payments->sum('amount')) }}</td></tr>
</table>
<p class="paid" style="margin-top: 14px; font-size: 13px">FACTURE ENTIÈREMENT RÉGLÉE</p>

<table class="stamp"><tr><td></td><td class="r">Signature et cachet<br><br><br>____________________</td></tr></table>
@endsection

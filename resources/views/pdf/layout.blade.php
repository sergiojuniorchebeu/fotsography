<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>@yield('title')</title>
<style>
    @page { margin: 32px 40px; }
    body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #1c1917; }
    .head { width: 100%; border-bottom: 2px solid #1c1917; padding-bottom: 12px; margin-bottom: 20px; }
    .head td { vertical-align: top; }
    .studio-name { font-size: 18px; font-weight: bold; letter-spacing: .5px; }
    .muted { color: #78716c; }
    .doc-title { font-size: 16px; font-weight: bold; text-align: right; text-transform: uppercase; }
    .doc-number { font-size: 12px; text-align: right; font-family: DejaVu Sans Mono, monospace; }
    h3 { font-size: 11px; text-transform: uppercase; color: #78716c; margin: 18px 0 6px; letter-spacing: .5px; }
    table.grid { width: 100%; border-collapse: collapse; }
    table.grid th { text-align: left; background: #f5f5f4; padding: 7px 8px; font-size: 10px; text-transform: uppercase; color: #57534e; }
    table.grid td { padding: 7px 8px; border-bottom: 1px solid #e7e5e4; }
    .r { text-align: right; }
    .total td { font-weight: bold; font-size: 13px; border-top: 2px solid #1c1917; border-bottom: none; }
    .box { border: 1px solid #e7e5e4; padding: 10px 12px; }
    .stamp { margin-top: 30px; width: 100%; }
    .foot { position: fixed; bottom: -10px; left: 0; right: 0; text-align: center; font-size: 9px; color: #a8a29e; }
    .paid { color: #15803d; font-weight: bold; }
</style>
</head>
<body>
<table class="head">
    <tr>
        <td style="width: 60%">
            @if($logo)<img src="{{ $logo }}" style="max-height: 56px; max-width: 180px; margin-bottom: 6px;"><br>@endif
            <div class="studio-name">{{ $studio->studio_name }}</div>
            <div class="muted">
                @if($studio->address){{ $studio->address }}<br>@endif
                @if($studio->phone)Tél. {{ $studio->phone }} @endif @if($studio->email) · {{ $studio->email }}@endif<br>
                @if($studio->niu_rccm)NIU / RCCM : {{ $studio->niu_rccm }}@endif
            </div>
        </td>
        <td>
            <div class="doc-title">@yield('title')</div>
            <div class="doc-number">@yield('number')</div>
            <div class="muted" style="text-align: right">@yield('date')</div>
        </td>
    </tr>
</table>
@yield('content')
<div class="foot">{{ $studio->studio_name }} — document généré le {{ now()->format('d/m/Y à H:i') }}</div>
</body>
</html>

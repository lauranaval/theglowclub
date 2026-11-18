from decimal import Decimal
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum
from django.shortcuts import render, redirect, get_object_or_404
from django.views.decorators.http import require_POST
from .models import Workshop, Session, Customer, Reservation, Payment
from .forms import WorkshopForm, SessionForm, ReservationForm, PaymentForm, ChangeForm
from .services import reserve, pay, change

@login_required
def home(request):
    workshops = Workshop.objects.prefetch_related('sessions').order_by('-created_at')
    active = list(Reservation.objects.filter(status__in=Reservation.ACTIVE).select_related('customer','session__workshop'))
    return render(request,'core/home.html',{'workshops':workshops,'overdue':[r for r in active if r.overdue], 'pending':sum((r.balance for r in active),Decimal(0)), 'active_seats':sum(r.seats for r in active)})

@login_required
def workshop_new(request):
    form = WorkshopForm(request.POST or None)
    session = SessionForm(request.POST or None, prefix='session')
    if request.method == 'POST' and form.is_valid() and session.is_valid():
        with transaction.atomic():
            w = form.save(commit=False); w.created_by=request.user; w.save()
            s = session.save(commit=False); s.workshop=w; s.created_by=request.user; s.save()
        messages.success(request,'Taller i primera sessió creats.')
        return redirect('workshop',pk=w.pk)
    return render(request,'core/form.html',{'title':'Nou taller','subtitle':'Crea un taller i la seva primera sessió.','form':form,'extra_form':session,'button':'Crear taller'})

@login_required
def workshop_detail(request,pk):
    w = get_object_or_404(Workshop,pk=pk)
    sessions = list(w.sessions.all())
    reservations = list(Reservation.objects.filter(session__workshop=w).select_related('customer','created_by','session'))
    payments = Payment.objects.filter(reservation__session__workshop=w).select_related('recorded_by','reservation__customer')
    summary = {item['method']:item['total'] for item in payments.values('method').annotate(total=Sum('amount'))}
    return render(request,'core/workshop.html',{'workshop':w,'sessions':sessions,'reservations':reservations,'payments':payments,'bizum':summary.get('bizum',0),'cash':summary.get('cash',0),'pending':sum((r.balance for r in reservations if r.status in Reservation.ACTIVE),Decimal(0)),'attendance':sum(r.attendance or 0 for r in reservations if r.status in Reservation.ACTIVE)})

@login_required
def session_new(request,pk):
    w=get_object_or_404(Workshop,pk=pk)
    form=SessionForm(request.POST or None)
    if request.method=='POST' and form.is_valid():
        s=form.save(commit=False); s.workshop=w; s.created_by=request.user; s.save()
        messages.success(request,'Sessió creada.'); return redirect('workshop',pk=pk)
    return render(request,'core/form.html',{'title':'Nova sessió','subtitle':w.title,'form':form,'button':'Crear sessió'})

@login_required
def reservation_new(request,pk):
    s=get_object_or_404(Session,pk=pk)
    form=ReservationForm(request.POST or None)
    if request.method=='POST' and form.is_valid():
        d=form.cleaned_data
        try:
            with transaction.atomic():
                c=d['customer'] or Customer.objects.create(name=d['name'],phone=d['phone'],email=d['email'],created_by=request.user)
                r=reserve(s.pk,c,d['seats'],d['waiting'],request.user)
            messages.success(request,'Reserva creada.'); return redirect('reservation',pk=r.pk)
        except ValidationError as e: form.add_error(None,e)
    return render(request,'core/form.html',{'title':'Nova reserva','subtitle':f'{s.workshop.title} · {s.available} places disponibles · {s.price} € / persona · senyal {s.deposit} € / persona','form':form,'button':'Crear reserva'})

@login_required
def reservation_detail(request,pk):
    r=get_object_or_404(Reservation.objects.select_related('customer','session__workshop','created_by'),pk=pk)
    form=PaymentForm(initial={'concept':'deposit' if r.deposit_pending else 'balance','amount':r.deposit_pending if r.deposit_pending else r.balance})
    if request.method=='POST':
        form=PaymentForm(request.POST)
        if form.is_valid():
            try:
                pay(r.pk,user=request.user,**form.cleaned_data)
                messages.success(request,'Cobrament registrat.'); return redirect('reservation',pk=pk)
            except ValidationError as e: form.add_error(None,e)
        r.refresh_from_db()
    return render(request,'core/reservation.html',{'r':r,'form':form,'payments':r.payments.select_related('recorded_by'),'history':r.history.select_related('actor')})

@login_required
@require_POST
def reservation_change(request,pk):
    get_object_or_404(Reservation,pk=pk)
    form=ChangeForm(request.POST)
    if form.is_valid():
        try:
            change(pk,user=request.user,**form.cleaned_data)
            messages.success(request,'Reserva actualitzada.')
        except ValidationError as e: messages.error(request,' '.join(e.messages))
    else: messages.error(request,'Dades no vàlides. Revisa les places, el termini o l’assistència.')
    return redirect('reservation',pk=pk)

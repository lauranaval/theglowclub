from datetime import timedelta
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from .models import Reservation, Session, Payment, Audit

def check_capacity(session, seats, excluding=None):
    occupied = session.reservations.filter(status__in=Reservation.ACTIVE)
    if excluding: occupied = occupied.exclude(pk=excluding)
    if sum(r.seats for r in occupied) + seats > session.capacity:
        raise ValidationError('No hi ha prou places disponibles. Pots crear una reserva en llista d’espera.')

def audit(r, user, text): Audit.objects.create(reservation=r, actor=user, action=text)

def locked_reservation(reservation_id):
    # Every writer locks Session before Reservation. Session membership is immutable.
    session_id = Reservation.objects.values_list('session_id', flat=True).get(pk=reservation_id)
    session = Session.objects.select_for_update().get(pk=session_id)
    reservation = Reservation.objects.select_for_update().get(pk=reservation_id)
    reservation.session = session
    return reservation

@transaction.atomic
def reserve(session_id, customer, seats, waiting, user):
    # Lock the session before checking availability (PostgreSQL row lock; SQLite IMMEDIATE).
    session = Session.objects.select_for_update().get(pk=session_id)
    if seats < 1: raise ValidationError('Cal reservar com a mínim una plaça.')
    if not waiting: check_capacity(session, seats)
    r = Reservation.objects.create(session=session, customer=customer, seats=seats,
        unit_price=session.price, unit_deposit=session.deposit,
        due_at=timezone.now()+timedelta(hours=session.workshop.payment_hours),
        status=Reservation.WAITING if waiting else (Reservation.CONFIRMED if session.deposit == 0 else Reservation.PENDING), created_by=user)
    audit(r, user, 'Alta de la reserva')
    return r

@transaction.atomic
def pay(reservation_id, amount, method, concept, paid_at, user):
    r = locked_reservation(reservation_id)
    if r.status not in Reservation.ACTIVE: raise ValidationError('Només es poden cobrar reserves actives.')
    if amount <= 0 or amount > r.balance: raise ValidationError('L’import ha de ser positiu i no pot superar el saldo pendent.')
    if concept == 'deposit':
        if method != 'bizum': raise ValidationError('La paga i senyal es registra per Bizum.')
        if amount > r.deposit_pending: raise ValidationError('L’import supera la senyal pendent. Registra la resta com a saldo final.')
    elif concept == 'balance':
        if r.deposit_pending: raise ValidationError('Cal completar la senyal abans de registrar el saldo final.')
    else: raise ValidationError('Concepte no vàlid.')
    if method not in ('bizum','cash'): raise ValidationError('Mètode no vàlid.')
    if paid_at > timezone.now(): raise ValidationError('La data del cobrament no pot ser futura.')
    Payment.objects.create(reservation=r,amount=amount,method=method,concept=concept,paid_at=paid_at,recorded_by=user)
    if r.deposit_pending == 0:
        r.status = Reservation.CONFIRMED
        r.save(update_fields=['status'])
    audit(r,user,f'Cobrament: {amount} € · {method} · {concept}')

@transaction.atomic
def change(reservation_id, action, user, seats=None, due_at=None, attendance=None):
    r = locked_reservation(reservation_id)
    if action == 'cancel':
        if r.status == Reservation.CANCELLED: raise ValidationError('La reserva ja està cancel·lada.')
        r.status = Reservation.CANCELLED
        text = 'Cancel·lació i alliberament manual de places'
    elif action == 'promote':
        if r.status != Reservation.WAITING: raise ValidationError('La reserva no és a la llista d’espera.')
        check_capacity(r.session,r.seats,r.pk)
        r.status = Reservation.CONFIRMED if r.deposit_pending == 0 else Reservation.PENDING
        r.due_at = timezone.now()+timedelta(hours=r.session.workshop.payment_hours)
        text = 'Promoció manual de la llista d’espera'
    elif action == 'seats':
        if r.status == Reservation.CANCELLED: raise ValidationError('La reserva està cancel·lada.')
        if not seats or seats < 1: raise ValidationError('El nombre de places ha de ser positiu.')
        if r.status in Reservation.ACTIVE: check_capacity(r.session,seats,r.pk)
        if seats*r.unit_price < r.paid or seats*r.unit_deposit < r.deposit_paid:
            raise ValidationError('No es poden reduir les places per sota dels imports ja cobrats.')
        if r.attendance is not None and seats < r.attendance: raise ValidationError('Hi ha més assistents registrades que places.')
        r.seats = seats
        if r.status in Reservation.ACTIVE: r.status = Reservation.CONFIRMED if r.deposit_pending == 0 else Reservation.PENDING
        text = f'Canvi de places: {seats}'
    elif action == 'extend':
        if r.status != Reservation.PENDING or not due_at or due_at <= max(timezone.now(),r.due_at): raise ValidationError('El nou termini ha de ser posterior a l’actual i al moment present, en una reserva pendent.')
        r.due_at = due_at
        text = f'Ampliació del termini: {due_at.isoformat()}'
    elif action == 'attendance':
        if r.status not in Reservation.ACTIVE or attendance is None or attendance < 0 or attendance > r.seats: raise ValidationError('L’assistència ha d’estar entre zero i el nombre de places d’una reserva activa.')
        r.attendance = attendance
        text = f'Assistència: {attendance}'
    else: raise ValidationError('Acció no vàlida.')
    r.save()
    audit(r,user,text)
    return r

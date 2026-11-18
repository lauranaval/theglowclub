from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from decimal import Decimal
from threading import Barrier
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import close_old_connections, connections
from django.test import TestCase, TransactionTestCase, Client, override_settings
from django.core import mail
import re
from django.urls import reverse
from django.utils import timezone
from .models import Workshop, Session, Customer, Reservation, Payment
from .services import reserve, pay, change

class Fixtures:
    def setup_data(self):
        self.user=User.objects.create_user('laura',password='TestPassword123!',first_name='Laura')
        self.other=User.objects.create_user('elena',password='TestPassword123!',first_name='Elena')
        self.w=Workshop.objects.create(title='Taller de prova',location='Estudi',payment_hours=48,created_by=self.user)
        self.s=Session.objects.create(workshop=self.w,starts_at=timezone.now()+timedelta(days=10),capacity=3,price=35,deposit=20,created_by=self.user)
        self.c=Customer.objects.create(name='Clienta fictícia',created_by=self.user)
    def book(self,seats=2,waiting=False): return reserve(self.s.pk,self.c,seats,waiting,self.user)
    def payment(self,r,amount,concept='deposit',method='bizum'):
        pay(r.pk,Decimal(amount),method,concept,timezone.now(),self.other); r.refresh_from_db()

class WorkflowTests(Fixtures,TestCase):
    def setUp(self): self.setup_data()
    def test_acceptance_partial_payments_and_attribution(self):
        r=self.book()
        self.assertEqual((r.total,r.required,r.balance,self.s.available),(70,40,70,1))
        self.payment(r,'15')
        self.assertEqual((r.status,r.deposit_pending,r.balance),('pending',25,55))
        self.payment(r,'25')
        self.assertEqual((r.status,r.balance),('confirmed',30))
        self.payment(r,'30','balance','cash')
        self.assertTrue(r.settled)
        self.assertEqual(r.balance,0)
        self.assertEqual(list(r.payments.values_list('recorded_by_id',flat=True)),[self.other.pk]*3)
        self.client.force_login(self.user)
        response=self.client.get(reverse('workshop',args=[self.w.pk]))
        self.assertEqual((response.context['bizum'],response.context['cash'],response.context['pending']),(40,30,0))
        self.assertEqual(r.created_by,self.user)
    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
    def test_password_reset_email_and_new_login(self):
        self.user.email='laura@example.test'; self.user.save()
        self.assertEqual(self.client.post(reverse('password_reset'),{'email':self.user.email}).status_code,302)
        self.assertEqual(len(mail.outbox),1)
        reset_path=re.search(r'http://testserver(/acces/restablir/[^\s]+)',mail.outbox[0].body).group(1)
        response=self.client.get(reset_path,follow=True)
        self.assertTrue(response.context['validlink'])
        response=self.client.post(response.request['PATH_INFO'],{'new_password1':'NewGlowPassword123!', 'new_password2':'NewGlowPassword123!'})
        self.assertEqual(response.status_code,302)
        self.assertTrue(self.client.login(username='laura',password='NewGlowPassword123!'))

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
    def test_unknown_email_does_not_reveal_accounts(self):
        self.assertEqual(self.client.post(reverse('password_reset'),{'email':'unknown@example.test'}).status_code,302)
        self.assertEqual(len(mail.outbox),0)

    def test_http_payment_form_accepts_money_and_rejects_zero(self):
        r=self.book(); self.client.force_login(self.user)
        url=reverse('reservation',args=[r.pk])
        data={'amount':'40.00','method':'bizum','concept':'deposit','paid_at':timezone.localtime().strftime('%Y-%m-%dT%H:%M')}
        self.assertEqual(self.client.post(url,data).status_code,302)
        r.refresh_from_db(); self.assertEqual((r.status,r.balance),('confirmed',30))
        data.update(amount='0',concept='balance',method='cash')
        response=self.client.post(url,data)
        self.assertEqual(response.status_code,200)
        self.assertTrue(response.context['form'].errors)
        self.assertEqual(r.payments.count(),1)

    def test_expiry_keeps_seats_until_manual_release(self):
        r=self.book()
        Reservation.objects.filter(pk=r.pk).update(due_at=timezone.now()-timedelta(hours=1))
        r.refresh_from_db(); self.assertTrue(r.overdue); self.assertEqual(self.s.available,1)
        self.client.force_login(self.user)
        self.assertContains(self.client.get('/'),'Senyals per revisar')
        change(r.pk,'cancel',self.other)
        self.assertEqual(self.s.available,3)
        self.assertIn('alliberament',r.history.first().action)
    def test_late_bizum_and_extension(self):
        r=self.book(); r.due_at=timezone.now()-timedelta(days=1); r.save()
        change(r.pk,'extend',self.user,due_at=timezone.now()+timedelta(days=1))
        r.refresh_from_db(); self.assertFalse(r.overdue)
        r.due_at=timezone.now()-timedelta(days=1); r.save()
        self.payment(r,'40'); self.assertEqual(r.status,'confirmed'); self.assertFalse(r.overdue)
    def test_capacity_waiting_and_promotion(self):
        r=self.book(3)
        with self.assertRaises(ValidationError): self.book(1)
        waiting=self.book(1,True); self.assertEqual(self.s.available,0)
        with self.assertRaises(ValidationError): change(waiting.pk,'promote',self.user)
        change(r.pk,'cancel',self.user); change(waiting.pk,'promote',self.other)
        self.assertEqual(self.s.available,2)
    def test_seat_change_is_checked_and_price_is_snapshotted(self):
        r=self.book(2); second=self.book(1)
        with self.assertRaises(ValidationError): change(r.pk,'seats',self.user,seats=3)
        Session.objects.filter(pk=self.s.pk).update(price=99,deposit=30)
        r.refresh_from_db(); self.assertEqual((r.unit_price,r.unit_deposit),(35,20))
        change(second.pk,'cancel',self.user)
        change(r.pk,'seats',self.user,seats=3)
        r.refresh_from_db(); self.assertEqual((r.total,r.required),(105,60))
    def test_attendance_is_independent_and_bounded(self):
        r=self.book(); change(r.pk,'attendance',self.user,attendance=1)
        r.refresh_from_db(); self.assertEqual((r.status,r.attendance),('pending',1))
        with self.assertRaises(ValidationError): change(r.pk,'attendance',self.user,attendance=3)
    def test_payment_guards_and_cancelled_history(self):
        r=self.book()
        for amount,concept,method in [('41','deposit','bizum'),('1','deposit','cash'),('30','balance','cash'),('0','deposit','bizum')]:
            with self.assertRaises(ValidationError): self.payment(r,amount,concept,method)
        self.payment(r,'40')
        with self.assertRaises(ValidationError): self.payment(r,'31','balance','cash')
        change(r.pk,'cancel',self.user)
        self.assertEqual(r.payments.count(),1)
        with self.assertRaises(ValidationError): self.payment(r,'30','balance','cash')
    def test_zero_deposit_is_confirmed(self):
        self.s.deposit=0; self.s.save()
        r=self.book(); self.assertEqual(r.status,'confirmed')
    def test_access_csrf_and_equal_permissions(self):
        for url in ['/',reverse('workshop',args=[self.w.pk]),reverse('reservation_new',args=[self.s.pk])]:
            self.assertEqual(self.client.get(url).status_code,302)
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(reverse('workshop_new')).status_code,200)
        secure=Client(enforce_csrf_checks=True); secure.force_login(self.user)
        self.assertEqual(secure.post(reverse('reservation_new',args=[self.s.pk]),{}).status_code,403)
        self.assertEqual(self.client.get('/sortir/').status_code,405)
    def test_failed_booking_rolls_back_new_customer(self):
        self.book(3); self.client.force_login(self.user)
        response=self.client.post(reverse('reservation_new',args=[self.s.pk]),{'name':'No s’ha de desar','seats':1})
        self.assertContains(response,'No hi ha prou places')
        self.assertFalse(Customer.objects.filter(name='No s’ha de desar').exists())

class ConcurrencyTests(Fixtures,TransactionTestCase):
    reset_sequences=True
    def setUp(self): self.setup_data()
    def parallel(self,fn):
        barrier=Barrier(2)
        def run(i):
            close_old_connections()
            try:
                barrier.wait(timeout=10)
                return fn(i)
            finally: connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool: return list(pool.map(run,[0,1]))
    def test_last_seat_via_two_authenticated_http_clients(self):
        self.s.capacity=1; self.s.save()
        clients=[Client(),Client()]
        for c,u in zip(clients,[self.user,self.other]): c.force_login(u)
        def post(i): return clients[i].post(reverse('reservation_new',args=[self.s.pk]),{'customer':self.c.pk,'seats':1}).status_code
        self.assertEqual(sorted(self.parallel(post)),[200,302])
        self.assertEqual(self.s.occupied,1)
        loser=clients[0]
        response=loser.post(reverse('reservation_new',args=[self.s.pk]),{'customer':self.c.pk,'seats':1,'waiting':'on'})
        self.assertEqual(response.status_code,302)
        self.assertEqual(Reservation.objects.filter(status='waiting').count(),1)
    def test_simultaneous_promotions(self):
        self.s.capacity=1; self.s.save()
        ids=[self.book(1,True).pk,self.book(1,True).pk]
        def promote(i):
            try: change(ids[i],'promote',self.user); return 'ok'
            except ValidationError: return 'full'
        self.assertEqual(sorted(self.parallel(promote)),['full','ok'])
        self.assertEqual(self.s.occupied,1)
    def test_simultaneous_payments_cannot_overcharge(self):
        r=self.book()
        def payment(i):
            try: pay(r.pk,Decimal(40),'bizum','deposit',timezone.now(),self.user); return 'ok'
            except ValidationError: return 'invalid'
        self.assertEqual(sorted(self.parallel(payment)),['invalid','ok'])
        self.assertEqual(r.paid,40)

    def test_booking_and_promotion_share_one_capacity_lock(self):
        self.s.capacity=1; self.s.save()
        waiting=self.book(1,True)
        def occupy(i):
            try:
                if i: change(waiting.pk,'promote',self.user)
                else: self.book(1)
                return 'ok'
            except ValidationError: return 'full'
        self.assertEqual(sorted(self.parallel(occupy)),['full','ok'])
        self.assertEqual(self.s.occupied,1)

    def test_simultaneous_seat_increases(self):
        ids=[self.book(1).pk,self.book(1).pk]
        def increase(i):
            try: change(ids[i],'seats',self.user,seats=2); return 'ok'
            except ValidationError: return 'full'
        self.assertEqual(sorted(self.parallel(increase)),['full','ok'])
        self.assertEqual(self.s.occupied,3)

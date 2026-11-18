from django.urls import path
from django.contrib.auth import views as auth
from core import views
from django.http import JsonResponse
from django.db import connection

def health(request):
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
    return JsonResponse({"status":"ok"})
urlpatterns = [
    path('healthz/', health, name='health'),
    path('acces/recuperar/', auth.PasswordResetView.as_view(), name='password_reset'),
    path('acces/correu-enviat/', auth.PasswordResetDoneView.as_view(), name='password_reset_done'),
    path('acces/restablir/<uidb64>/<token>/', auth.PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    path('acces/contrasenya-desada/', auth.PasswordResetCompleteView.as_view(), name='password_reset_complete'),
    path('acces/',auth.LoginView.as_view(),name='login'),
    path('sortir/',auth.LogoutView.as_view(),name='logout'),
    path('',views.home,name='home'),
    path('tallers/nou/',views.workshop_new,name='workshop_new'),
    path('tallers/<int:pk>/',views.workshop_detail,name='workshop'),
    path('tallers/<int:pk>/sessions/nova/',views.session_new,name='session_new'),
    path('sessions/<int:pk>/reserves/nova/',views.reservation_new,name='reservation_new'),
    path('reserves/<int:pk>/',views.reservation_detail,name='reservation'),
    path('reserves/<int:pk>/canvi/',views.reservation_change,name='reservation_change'),
]

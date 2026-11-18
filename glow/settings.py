from pathlib import Path
import os
import dj_database_url
BASE_DIR = Path(__file__).resolve().parent.parent
DEBUG = os.environ.get('GLOW_DEBUG', '1') == '1'
SECRET_KEY = os.environ.get('GLOW_SECRET_KEY', 'local-demo-only-change-before-deploying')
if not DEBUG and SECRET_KEY == 'local-demo-only-change-before-deploying':
    raise RuntimeError('Cal configurar GLOW_SECRET_KEY en producció')
ALLOWED_HOSTS = os.environ.get('GLOW_ALLOWED_HOSTS', 'localhost,127.0.0.1,[::1]').split(',')
if os.environ.get('RENDER_EXTERNAL_HOSTNAME'):
    ALLOWED_HOSTS.append(os.environ['RENDER_EXTERNAL_HOSTNAME'])
CSRF_TRUSTED_ORIGINS = [v for v in os.environ.get('GLOW_CSRF_TRUSTED_ORIGINS', '').split(',') if v]
if os.environ.get('RENDER_EXTERNAL_HOSTNAME'):
    CSRF_TRUSTED_ORIGINS.append('https://' + os.environ['RENDER_EXTERNAL_HOSTNAME'])
INSTALLED_APPS = ['django.contrib.auth','django.contrib.contenttypes','django.contrib.sessions','django.contrib.messages','django.contrib.staticfiles','core']
MIDDLEWARE = ['django.middleware.security.SecurityMiddleware','whitenoise.middleware.WhiteNoiseMiddleware','django.contrib.sessions.middleware.SessionMiddleware','django.middleware.common.CommonMiddleware','django.middleware.csrf.CsrfViewMiddleware','django.contrib.auth.middleware.AuthenticationMiddleware','django.contrib.messages.middleware.MessageMiddleware','django.middleware.clickjacking.XFrameOptionsMiddleware']
ROOT_URLCONF = 'glow.urls'
TEMPLATES = [{'BACKEND':'django.template.backends.django.DjangoTemplates','DIRS':[],'APP_DIRS':True,'OPTIONS':{'context_processors':['django.template.context_processors.request','django.contrib.auth.context_processors.auth','django.contrib.messages.context_processors.messages']}}]
WSGI_APPLICATION = 'glow.wsgi.application'
if os.environ.get('DATABASE_URL'):
    DATABASES = {'default': dj_database_url.parse(os.environ['DATABASE_URL'], conn_max_age=60, conn_health_checks=True)}
    if DATABASES['default']['ENGINE'] != 'django.db.backends.postgresql':
        raise RuntimeError('DATABASE_URL ha de correspondre a PostgreSQL')
elif DEBUG:
    DATABASES = {'default':{'ENGINE':'django.db.backends.sqlite3','NAME':os.environ.get('GLOW_DB', BASE_DIR / 'db.sqlite3'),'OPTIONS':{'timeout':20,'transaction_mode':'IMMEDIATE'},'TEST':{'NAME':BASE_DIR / 'work' / 'test.sqlite3'}}}
else:
    raise RuntimeError('Cal configurar DATABASE_URL en producció; SQLite no és persistent a Render')
AUTH_PASSWORD_VALIDATORS = [{'NAME':'django.contrib.auth.password_validation.MinimumLengthValidator'}]
LANGUAGE_CODE = 'ca'
TIME_ZONE = 'Europe/Madrid'
USE_I18N = True
USE_TZ = True
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
LOGIN_URL = 'login'
LOGIN_REDIRECT_URL = 'home'
LOGOUT_REDIRECT_URL = 'login'
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage' if DEBUG else 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = True
    SECURE_HSTS_SECONDS = 3600
    SECURE_HSTS_INCLUDE_SUBDOMAINS = False
    SECURE_HSTS_PRELOAD = False
    SECURE_REDIRECT_EXEMPT = [r'^healthz/$']
EMAIL_BACKEND = os.environ.get('GLOW_EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend' if DEBUG else 'django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = os.environ.get('GLOW_EMAIL_HOST', '')
EMAIL_PORT = int(os.environ.get('GLOW_EMAIL_PORT', '587'))
EMAIL_USE_TLS = os.environ.get('GLOW_EMAIL_USE_TLS', '1') == '1'
EMAIL_HOST_USER = os.environ.get('GLOW_EMAIL_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('GLOW_EMAIL_PASSWORD', '')
EMAIL_TIMEOUT = 15
DEFAULT_FROM_EMAIL = os.environ.get('GLOW_FROM_EMAIL', 'Glow Club <noreply@example.test>')
PASSWORD_RESET_TIMEOUT = 3600

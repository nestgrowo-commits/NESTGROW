from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.core'
    label = 'core'

    def ready(self):
        from django.db.models.signals import post_save, post_delete
        from apps.core.sync import sync_save, sync_delete
        post_save.connect(sync_save, dispatch_uid='nestgrow_sync_save')
        post_delete.connect(sync_delete, dispatch_uid='nestgrow_sync_delete')

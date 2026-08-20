.class public final Lcom/verudanava/nava/NavaNotificationRepair;
.super Ljava/lang/Object;

.method public static ensure(Landroid/content/Context;)V
    .registers 7

    const-string v0, "notification"
    invoke-virtual {p0, v0}, Landroid/content/Context;->getSystemService(Ljava/lang/String;)Ljava/lang/Object;
    move-result-object v0
    check-cast v0, Landroid/app/NotificationManager;
    if-eqz v0, :done

    sget v1, Landroid/os/Build$VERSION;->SDK_INT:I
    const/16 v2, 0x1a
    if-lt v1, v2, :check_enabled

    new-instance v2, Landroid/app/NotificationChannel;
    const-string v3, "nava_follower_releases_v3"
    const-string v4, "Takip edilen eserler"
    const/4 v5, 0x4
    invoke-direct {v2, v3, v4, v5}, Landroid/app/NotificationChannel;-><init>(Ljava/lang/String;Ljava/lang/CharSequence;I)V
    const-string v3, "Takip ettiğin eserlerde yeni cilt ve bölüm bildirimleri"
    invoke-virtual {v2, v3}, Landroid/app/NotificationChannel;->setDescription(Ljava/lang/String;)V
    invoke-virtual {v0, v2}, Landroid/app/NotificationManager;->createNotificationChannel(Landroid/app/NotificationChannel;)V

    :check_enabled
    const/16 v2, 0x18
    if-lt v1, v2, :done
    invoke-virtual {v0}, Landroid/app/NotificationManager;->areNotificationsEnabled()Z
    move-result v0
    if-nez v0, :done

    new-instance v0, Landroid/content/Intent;
    const-string v1, "android.settings.APP_NOTIFICATION_SETTINGS"
    invoke-direct {v0, v1}, Landroid/content/Intent;-><init>(Ljava/lang/String;)V
    const-string v1, "android.provider.extra.APP_PACKAGE"
    invoke-virtual {p0}, Landroid/content/Context;->getPackageName()Ljava/lang/String;
    move-result-object v2
    invoke-virtual {v0, v1, v2}, Landroid/content/Intent;->putExtra(Ljava/lang/String;Ljava/lang/String;)Landroid/content/Intent;
    const/high16 v1, 0x10000000
    invoke-virtual {v0, v1}, Landroid/content/Intent;->addFlags(I)Landroid/content/Intent;
    invoke-virtual {p0, v0}, Landroid/content/Context;->startActivity(Landroid/content/Intent;)V

    :done
    return-void
.end method

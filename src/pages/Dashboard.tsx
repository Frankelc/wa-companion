import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Heart, Eye, Trash2, Bot, Calendar, Sparkles, TrendingUp, Activity, Loader2, Ghost } from "lucide-react";
import { useDashboard } from "@/hooks/useDashboard";
import { useWhatsApp } from "@/hooks/useWhatsApp";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { PlanBadge } from "@/components/PlanBadge";
import { Loading } from "@/components/Loading";

const Dashboard = () => {
  const { user, isPremium, stats, recentActivity, isLoading, quota } = useDashboard();
  const { status: whatsappStatus, isConnected, reconnect: manualReconnect, isReconnecting } = useWhatsApp();
  const navigate = useNavigate();

  // Fetch Snap status
  const { data: snapBotStatus } = useQuery({
    queryKey: ["snap-status"],
    queryFn: async () => {
      const API_URL = import.meta.env.VITE_API_URL || "https://wa-companion.onrender.com";
      const r = await fetch(`${API_URL}/api/snap/status`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("amda_token")}` },
      });
      return r.json();
    },
    refetchInterval: 10000,
  });

  const isSnapConnected = snapBotStatus?.data?.is_connected ?? false;
  const isSnapCapturing = snapBotStatus?.data?.is_capturing ?? false;

  // Format stats for display
  const displayStats = [
    {
      title: "Status Likés",
      value: stats.statusLiked.toString(),
      subtitle: "aujourd'hui",
      icon: Heart,
      color: "text-pink-500",
      bgColor: "bg-pink-50 dark:bg-pink-950/20"
    },
    {
      title: "View Once",
      value: stats.viewOnceLimit === Infinity 
        ? `${stats.viewOnceCount}` 
        : `${stats.viewOnceCount}/${stats.viewOnceLimit}`,
      subtitle: "ce mois",
      icon: Eye,
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
      progress: stats.viewOnceLimit === Infinity 
        ? 0 
        : (stats.viewOnceCount / stats.viewOnceLimit) * 100
    },
    {
      title: "Messages Récupérés",
      value: stats.deletedMessagesLimit === Infinity 
        ? `${stats.deletedMessagesCount}` 
        : `${stats.deletedMessagesCount}/${stats.deletedMessagesLimit}`,
      subtitle: "ce mois",
      icon: Trash2,
      color: "text-orange-500",
      bgColor: "bg-orange-50 dark:bg-orange-950/20",
      progress: stats.deletedMessagesLimit === Infinity 
        ? 0 
        : (stats.deletedMessagesCount / stats.deletedMessagesLimit) * 100
    },
    {
      title: "Réponses Auto",
      value: stats.autoReplies.toString(),
      subtitle: "cette semaine",
      icon: Bot,
      color: "text-emerald-500",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/20"
    }
  ];

  // Format activity icons
  const activityIcons = {
    status: Heart,
    view_once: Eye,
    deleted_message: Trash2,
    autoresponder: Bot,
  };

  const activityColors = {
    status: "text-pink-500",
    view_once: "text-blue-500",
    deleted_message: "text-orange-500",
    autoresponder: "text-emerald-500",
  };

  const canManualReconnect = !!whatsappStatus?.hasSavedSession;
  const lastActivity = whatsappStatus?.lastSeen || whatsappStatus?.connectedAt;
  const lastActivityLabel = lastActivity
    ? new Date(lastActivity).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null;
  const manualReconnectDisabled = isReconnecting || whatsappStatus?.status === 'connecting';

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6 px-2 sm:px-4 md:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 md:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2">Tableau de bord</h1>
          <p className="text-xs sm:text-sm md:text-base text-muted-foreground">
            Bienvenue de retour ! Voici un aperçu de votre activité.
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {isLoading ? (
            <div className="h-6 w-20 flex items-center justify-center">
              <Loading size="sm" showLogo={false} text="" />
            </div>
          ) : (
            <PlanBadge plan={user?.plan || 'free'} />
          )}
          {!isPremium && (
            <Button 
              className="bg-gradient-premium text-xs sm:text-sm px-2 sm:px-3 md:px-4 h-8 sm:h-9 md:h-10"
              onClick={() => navigate('/dashboard/upgrade')}
            >
              <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Passer à Premium</span>
              <span className="sm:hidden">Premium</span>
            </Button>
          )}
        </div>
      </div>

      {/* WhatsApp Connection Status */}
      <Card className="border-border bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5">
        <CardContent className="pt-3 sm:pt-4 md:pt-6 px-3 sm:px-4 md:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 md:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 rounded-full flex-shrink-0 ${
                isConnected 
                  ? 'bg-green-500 animate-pulse' 
                  : whatsappStatus?.status === 'connecting'
                  ? 'bg-yellow-500 animate-pulse'
                  : 'bg-red-500'
              }`}></div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-xs sm:text-sm md:text-base truncate">
                  {isConnected 
                    ? 'WhatsApp Connecté' 
                    : whatsappStatus?.status === 'connecting'
                    ? 'Connexion en cours...'
                    : 'WhatsApp Non Connecté'}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  {whatsappStatus?.lastSeen 
                    ? `Dernière sync : ${new Date(whatsappStatus.lastSeen).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                    : 'Reliez votre WhatsApp pour commencer'}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
              {canManualReconnect && (
                <Button
                  className="w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-9 md:h-10 whitespace-nowrap"
                  onClick={() => manualReconnect()}
                  disabled={manualReconnectDisabled}
                >
                  {isReconnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ...
                    </>
                  ) : (
                    'Relancer Session'
                  )}
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-9 md:h-10 whitespace-nowrap"
                onClick={() => navigate('/dashboard/connect')}
              >
                {isConnected ? 'Gérer Connexion' : 'Associer WhatsApp'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Snapchat Connection Status */}
      <Card className="border-border bg-gradient-to-r from-yellow-500/5 to-yellow-500/10 dark:from-yellow-500/10 dark:to-yellow-500/5">
        <CardContent className="pt-3 sm:pt-4 md:pt-6 px-3 sm:px-4 md:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 md:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 rounded-full flex-shrink-0 ${
                isSnapCapturing 
                  ? 'bg-green-500 animate-pulse' 
                  : isSnapConnected
                  ? 'bg-yellow-500'
                  : 'bg-muted-foreground'
              }`}></div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-xs sm:text-sm md:text-base truncate">
                  Snapchat {isSnapCapturing ? 'Capture Active' : isSnapConnected ? 'Connecté' : 'Non Connecté'}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  {isSnapCapturing 
                    ? 'Captures silencieuses en cours...' 
                    : isSnapConnected 
                    ? 'Session prête pour la capture'
                    : 'Reliez votre compte Snapchat pour la capture silencieuse'}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
              <Button 
                variant={isSnapConnected ? "outline" : "default"}
                size="sm" 
                className={cn(
                  "w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-9 md:h-10 whitespace-nowrap",
                  !isSnapConnected && "bg-yellow-500 hover:bg-yellow-600 text-yellow-950 font-bold"
                )}
                onClick={() => navigate('/dashboard/connect')}
              >
                {isSnapConnected ? 'Gérer Snap' : 'Associer Snapchat'}
                <Ghost className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {isLoading ? (
          <div className="col-span-full">
            <Loading text="Chargement des statistiques..." showLogo={true} />
          </div>
        ) : (
          displayStats.map((stat, index) => (
          <Card key={index} className="border-border hover:shadow-md transition-shadow">
            <CardContent className="pt-4 sm:pt-5 md:pt-6 px-4 sm:px-5 md:px-6">
              <div className="flex items-start justify-between mb-3 sm:mb-4">
                <div className={`p-2 sm:p-2.5 md:p-3 rounded-lg ${stat.bgColor} flex-shrink-0`}>
                  <stat.icon className={`w-4 h-4 sm:w-4.5 md:w-5 sm:h-4.5 md:h-5 ${stat.color}`} />
                </div>
                <TrendingUp className="w-3 h-3 sm:w-3.5 md:w-4 sm:h-3.5 md:h-4 text-muted-foreground flex-shrink-0" />
              </div>
              <div>
                <p className="text-lg sm:text-xl md:text-2xl font-bold mb-1">{stat.value}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 sm:mt-1">{stat.subtitle}</p>
                {stat.progress !== undefined && (
                  <Progress value={stat.progress} className="mt-2 sm:mt-3 h-1" />
                )}
              </div>
            </CardContent>
          </Card>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent Activity */}
        <Card className="border-border">
          <CardHeader className="pb-3 sm:pb-4 px-4 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base md:text-lg">
              <Activity className="w-4 h-4 sm:w-4.5 md:w-5 sm:h-4.5 md:h-5 flex-shrink-0" />
              Activité récente
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Vos dernières interactions automatisées</CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            {isLoading ? (
              <Loading text="Chargement de l'activité..." showLogo={true} size="sm" />
            ) : recentActivity.length > 0 ? (
              <div className="space-y-2 sm:space-y-3 md:space-y-4">
                {recentActivity.map((activity) => {
                  const Icon = activityIcons[activity.type];
                  const color = activityColors[activity.type];
                  return (
                    <div key={activity.id} className="flex items-center gap-2 sm:gap-3 md:gap-4 p-2 sm:p-2.5 md:p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div className={`p-1.5 sm:p-2 rounded-full bg-background flex-shrink-0`}>
                        <Icon className={`w-3 h-3 sm:w-3.5 md:w-4 sm:h-3.5 md:h-4 ${color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium truncate">{activity.action}</p>
                        <p className="text-xs text-muted-foreground truncate">{activity.contact}</p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">{activity.time}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 sm:py-8 text-xs sm:text-sm text-muted-foreground">
                Aucune activité récente
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border-border">
          <CardHeader className="pb-3 sm:pb-4 px-4 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base md:text-lg">
              <Calendar className="w-4 h-4 sm:w-4.5 md:w-5 sm:h-4.5 md:h-5 flex-shrink-0" />
              Actions rapides
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Gérez vos fonctionnalités principales</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 sm:space-y-2.5 md:space-y-3 px-4 sm:px-6">
            <Button 
              variant="outline" 
              className="w-full justify-start text-xs sm:text-sm h-auto py-2 sm:py-2.5 md:py-3"
              onClick={() => navigate('/dashboard/status/config')}
            >
              <Heart className="w-3 h-3 sm:w-3.5 md:w-4 sm:h-3.5 md:h-4 mr-2 sm:mr-2.5 md:mr-3 flex-shrink-0" />
              <div className="text-left flex-1 min-w-0">
                <div className="font-medium text-xs sm:text-sm truncate">Configurer Auto-Like</div>
                <div className="text-xs text-muted-foreground hidden sm:block truncate">Choisir emoji et contacts</div>
              </div>
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start text-xs sm:text-sm h-auto py-2 sm:py-2.5 md:py-3"
              onClick={() => navigate('/dashboard/status/schedule')}
            >
              <Calendar className="w-3 h-3 sm:w-3.5 md:w-4 sm:h-3.5 md:h-4 mr-2 sm:mr-2.5 md:mr-3 flex-shrink-0" />
              <div className="text-left flex-1 min-w-0">
                <div className="font-medium text-xs sm:text-sm truncate">Programmer un Status</div>
                <div className="text-xs text-muted-foreground hidden sm:block truncate">
                  {quota?.scheduledStatuses?.used || 0}/{quota?.scheduledStatuses?.limit === Infinity ? '∞' : quota?.scheduledStatuses?.limit || 5} utilisé ce mois
                </div>
              </div>
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start text-xs sm:text-sm h-auto py-2 sm:py-2.5 md:py-3"
              onClick={() => navigate('/dashboard/autoresponder')}
            >
              <Bot className="w-3 h-3 sm:w-3.5 md:w-4 sm:h-3.5 md:h-4 mr-2 sm:mr-2.5 md:mr-3 flex-shrink-0" />
              <div className="text-left flex-1 min-w-0">
                <div className="font-medium text-xs sm:text-sm truncate">Activer Répondeur</div>
                <div className="text-xs text-muted-foreground hidden sm:block truncate">Mode Hors Ligne / Occupé</div>
              </div>
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start text-xs sm:text-sm h-auto py-2 sm:py-2.5 md:py-3"
              onClick={() => navigate('/dashboard/view-once')}
            >
              <Eye className="w-3 h-3 sm:w-3.5 md:w-4 sm:h-3.5 md:h-4 mr-2 sm:mr-2.5 md:mr-3 flex-shrink-0" />
              <div className="text-left flex-1 min-w-0">
                <div className="font-medium text-xs sm:text-sm truncate">Voir View Once</div>
                <div className="text-xs text-muted-foreground hidden sm:block truncate">
                  {stats.viewOnceCount} capture{stats.viewOnceCount > 1 ? 's' : ''} disponible{stats.viewOnceCount > 1 ? 's' : ''}
                </div>
              </div>
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start text-xs sm:text-sm h-auto py-2 sm:py-2.5 md:py-3"
              onClick={() => navigate('/dashboard/snap-captures')}
            >
              <Ghost className="w-3 h-3 sm:w-3.5 md:w-4 sm:h-3.5 md:h-4 mr-2 sm:mr-2.5 md:mr-3 flex-shrink-0 text-yellow-500" />
              <div className="text-left flex-1 min-w-0">
                <div className="font-medium text-xs sm:text-sm truncate">Galerie Snapchat</div>
                <div className="text-xs text-muted-foreground hidden sm:block truncate">
                  Voir vos Snaps et Stories capturés
                </div>
              </div>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Premium Upsell */}
      <Card className="border-premium shadow-premium bg-gradient-to-r from-premium/5 to-premium/10 dark:from-premium/10 dark:to-premium/15">
        <CardContent className="pt-4 sm:pt-5 md:pt-6 px-4 sm:px-5 md:px-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg md:text-xl font-bold mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 sm:w-4.5 md:w-5 sm:h-4.5 md:h-5 text-premium flex-shrink-0" />
                <span className="text-sm sm:text-base md:text-lg">Débloquez toute la puissance avec Premium</span>
              </h3>
              <ul className="text-xs sm:text-sm text-muted-foreground space-y-1">
                <li>✓ View Once et Messages supprimés illimités</li>
                <li>✓ Filtrage intelligent du répondeur automatique</li>
                <li>✓ Analytics détaillés et statistiques avancées</li>
                <li>✓ Support prioritaire et backup automatique</li>
              </ul>
            </div>
            <Button 
              className="bg-gradient-premium whitespace-nowrap text-xs sm:text-sm w-full sm:w-auto flex-shrink-0"
              onClick={() => navigate('/dashboard/upgrade')}
            >
              <span className="hidden sm:inline">Essayer 30 jours</span>
              <span className="sm:hidden">Essayer</span>
              <Sparkles className="w-3 h-3 sm:w-3.5 md:w-4 sm:h-3.5 md:h-4 ml-1 sm:ml-2 flex-shrink-0" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
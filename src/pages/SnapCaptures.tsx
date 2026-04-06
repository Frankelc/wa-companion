import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MediaViewer } from "@/components/ui/media-viewer";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Ghost, Play, Square, LogIn, LogOut, Download, Eye,
  Trash2, ImageIcon, Radio, Camera, Shield, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Loading } from "@/components/Loading";

const API_URL = import.meta.env.VITE_API_URL || "https://wa-companion.onrender.com";

// ─── API helpers ─────────────────────────────────────────────────────────────
const snapApi = {
  status: () => fetch(`${API_URL}/api/snap/status`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("amda_token")}` },
  }).then((r) => r.json()),

  login: (username: string, password: string) =>
    fetch(`${API_URL}/api/snap/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("amda_token")}` },
      body: JSON.stringify({ username, password }),
    }).then((r) => r.json()),

  logout: () =>
    fetch(`${API_URL}/api/snap/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("amda_token")}` },
    }).then((r) => r.json()),

  startCapture: () =>
    fetch(`${API_URL}/api/snap/start-capture`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("amda_token")}` },
    }).then((r) => r.json()),

  stopCapture: () =>
    fetch(`${API_URL}/api/snap/stop-capture`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("amda_token")}` },
    }).then((r) => r.json()),

  captures: (isStory?: boolean) => {
    const url = new URL(`${API_URL}/api/snap/captures`);
    if (isStory !== undefined) url.searchParams.set("is_story", String(isStory));
    return fetch(url.toString(), {
      headers: { Authorization: `Bearer ${localStorage.getItem("amda_token")}` },
    }).then((r) => r.json());
  },

  stats: () =>
    fetch(`${API_URL}/api/snap/stats`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("amda_token")}` },
    }).then((r) => r.json()),

  delete: (id: string) =>
    fetch(`${API_URL}/api/snap/captures/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${localStorage.getItem("amda_token")}` },
    }).then((r) => r.json()),
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface SnapCapture {
  id: string;
  sender_username: string;
  media_url: string;
  media_type: "image" | "video";
  is_story: boolean;
  captured_at: string;
}

// ─── Main Page Component ──────────────────────────────────────────────────────
export default function SnapCaptures() {
  const qc = useQueryClient();
  const [snapUser, setSnapUser] = useState("");
  const [snapPass, setSnapPass] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<{ url: string; type: "image" | "video"; title: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "snaps" | "stories">("all");

  // ─── Queries ────────────────────────────────────────────────────────────────
  const { data: botStatus } = useQuery({
    queryKey: ["snap-status"],
    queryFn: snapApi.status,
    refetchInterval: 5000,
  });

  const isConnected = botStatus?.data?.is_connected ?? false;
  const isCapturing = botStatus?.data?.is_capturing ?? false;

  const { data: statsData } = useQuery({
    queryKey: ["snap-stats"],
    queryFn: snapApi.stats,
    refetchInterval: 30000,
  });
  const stats = statsData?.data ?? { capturedToday: 0, capturedThisMonth: 0, totalCaptured: 0, storiesCount: 0 };

  const isStoryFilter = activeTab === "all" ? undefined : activeTab === "stories";
  const { data: capturesData, isLoading } = useQuery({
    queryKey: ["snap-captures", activeTab],
    queryFn: () => snapApi.captures(isStoryFilter),
    refetchInterval: 10000,
  });
  const captures: SnapCapture[] = capturesData?.data ?? [];

  // ─── Mutations ──────────────────────────────────────────────────────────────
  const loginMut = useMutation({
    mutationFn: () => snapApi.login(snapUser, snapPass),
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message || "Connecté à Snapchat !");
        qc.invalidateQueries({ queryKey: ["snap-status"] });
      } else {
        toast.error(data.error?.message || "Connexion échouée");
      }
    },
  });

  const logoutMut = useMutation({
    mutationFn: snapApi.logout,
    onSuccess: () => {
      toast.info("Déconnecté de Snapchat");
      qc.invalidateQueries({ queryKey: ["snap-status"] });
    },
  });

  const startMut = useMutation({
    mutationFn: snapApi.startCapture,
    onSuccess: (data) => {
      if (data.success) toast.success("Capture silencieuse démarrée 👻");
      else toast.error(data.error?.message || "Impossible de démarrer la capture");
      qc.invalidateQueries({ queryKey: ["snap-status"] });
    },
  });

  const stopMut = useMutation({
    mutationFn: snapApi.stopCapture,
    onSuccess: () => {
      toast.info("Capture arrêtée");
      qc.invalidateQueries({ queryKey: ["snap-status"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => snapApi.delete(id),
    onSuccess: () => {
      toast.success("Capture supprimée");
      qc.invalidateQueries({ queryKey: ["snap-captures"] });
      qc.invalidateQueries({ queryKey: ["snap-stats"] });
    },
  });

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 mb-1">
            <Ghost className="w-7 h-7 text-yellow-400" />
            Snap Captures
          </h1>
          <p className="text-sm text-muted-foreground">
            Télécharge tes Snaps et Stories silencieusement — sans notification côté expéditeur.
          </p>
        </div>
        <Badge variant="outline" className={`self-start sm:self-center gap-2 px-3 py-1.5 ${isCapturing ? "border-green-500 text-green-600" : isConnected ? "border-yellow-500 text-yellow-600" : "border-muted-foreground"}`}>
          <span className={`w-2 h-2 rounded-full ${isCapturing ? "bg-green-500 animate-pulse" : isConnected ? "bg-yellow-500" : "bg-muted-foreground"}`} />
          {isCapturing ? "En cours de capture" : isConnected ? "Connecté" : "Déconnecté"}
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Aujourd'hui", value: stats.capturedToday, icon: Camera, color: "text-yellow-500" },
          { label: "Ce mois", value: stats.capturedThisMonth, icon: Zap, color: "text-blue-500" },
          { label: "Total Snaps", value: stats.totalCaptured - stats.storiesCount, icon: Ghost, color: "text-purple-500" },
          { label: "Stories", value: stats.storiesCount, icon: Radio, color: "text-pink-500" },
        ].map((s) => (
          <Card key={s.label} className="overflow-hidden">
            <CardContent className="p-3 sm:p-4 flex items-center gap-3">
              <div className={`p-2 bg-muted rounded-lg ${s.color}`}>
                <s.icon className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Connection Panel ──────────────────────────────────────────────── */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="w-4 h-4 text-primary" />
              Compte Snapchat
            </CardTitle>
            <CardDescription>Connectez un compte dédié pour activer la capture</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isConnected ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="snap-username">Nom d'utilisateur</Label>
                  <Input
                    id="snap-username"
                    placeholder="your_snap_username"
                    value={snapUser}
                    onChange={(e) => setSnapUser(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="snap-password">Mot de passe</Label>
                  <Input
                    id="snap-password"
                    type="password"
                    placeholder="••••••••"
                    value={snapPass}
                    onChange={(e) => setSnapPass(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full gap-2"
                  onClick={() => loginMut.mutate()}
                  disabled={loginMut.isPending || !snapUser || !snapPass}
                >
                  <LogIn className="w-4 h-4" />
                  {loginMut.isPending ? "Connexion en cours..." : "Se connecter à Snapchat"}
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <Avatar className="h-9 w-9 bg-yellow-400">
                    <AvatarFallback className="bg-yellow-400 text-yellow-900 font-bold text-sm">👻</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">Compte Snapchat actif</p>
                    <p className="text-xs text-muted-foreground">Session en cours</p>
                  </div>
                </div>

                {/* Start / Stop Capture */}
                {!isCapturing ? (
                  <Button
                    className="w-full gap-2 bg-yellow-500 hover:bg-yellow-600 text-white"
                    onClick={() => startMut.mutate()}
                    disabled={startMut.isPending}
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Démarrer la capture
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    className="w-full gap-2"
                    onClick={() => stopMut.mutate()}
                    disabled={stopMut.isPending}
                  >
                    <Square className="w-4 h-4 fill-current" />
                    Arrêter la capture
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 text-muted-foreground"
                  onClick={() => logoutMut.mutate()}
                  disabled={logoutMut.isPending}
                >
                  <LogOut className="w-3 h-3" />
                  Déconnecter le compte
                </Button>

                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  Le bot intercepte les médias <strong>avant</strong> de les marquer comme vus.
                  L'expéditeur ne reçoit aucune notification.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Gallery ───────────────────────────────────────────────────────── */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle>Galerie des captures</CardTitle>
            <CardDescription>Snaps et Stories sauvegardés silencieusement</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">Tout</TabsTrigger>
                <TabsTrigger value="snaps">Snaps</TabsTrigger>
                <TabsTrigger value="stories">Stories</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab}>
                {isLoading ? (
                  <Loading text="Chargement des captures..." showLogo={false} />
                ) : captures.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Ghost className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-base font-medium mb-1">Aucune capture</p>
                    <p className="text-sm">
                      {isConnected && isCapturing
                        ? "En attente de nouveaux Snaps..."
                        : "Connectez un compte et démarrez la capture"}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {captures.map((cap) => (
                      <Card key={cap.id} className="overflow-hidden group hover:shadow-md transition-shadow">
                        <CardContent className="p-0">
                          {/* Thumbnail */}
                          <div className="aspect-square bg-muted flex items-center justify-center relative overflow-hidden">
                            {cap.media_type === "image" ? (
                              <img
                                src={cap.media_url}
                                alt="Snap"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                onError={(e) => { e.currentTarget.style.display = "none"; }}
                              />
                            ) : (
                              <video
                                src={cap.media_url}
                                className="w-full h-full object-cover"
                                muted
                              />
                            )}
                            {/* Badges */}
                            <div className="absolute top-2 left-2 flex gap-1">
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 h-auto">
                                {cap.is_story ? "Story" : "Snap"}
                              </Badge>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="p-2 space-y-1.5">
                            <p className="text-xs font-medium truncate">@{cap.sender_username}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(cap.captured_at).toLocaleString("fr-FR", {
                                day: "2-digit", month: "2-digit",
                                hour: "2-digit", minute: "2-digit",
                              })}
                            </p>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 h-7 text-[11px] px-1"
                                onClick={() => setSelectedMedia({ url: cap.media_url, type: cap.media_type, title: `@${cap.sender_username}` })}
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                Voir
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 h-7 text-[11px] px-1"
                                onClick={() => {
                                  const a = document.createElement("a");
                                  a.href = cap.media_url;
                                  a.download = `snap-${cap.id}`;
                                  a.click();
                                  toast.success("Téléchargement démarré");
                                }}
                              >
                                <Download className="w-3 h-3 mr-1" />
                                DL
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-7 w-7 p-0"
                                    disabled={deletingId === cap.id}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Supprimer cette capture ?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      La capture sera définitivement supprimée. Cette action est irréversible.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground"
                                      onClick={() => deleteMut.mutate(cap.id)}
                                    >
                                      Supprimer
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Media Viewer */}
      {selectedMedia && (
        <MediaViewer
          mediaUrl={selectedMedia.url}
          mediaType={selectedMedia.type}
          isOpen={!!selectedMedia}
          onClose={() => setSelectedMedia(null)}
          onDownload={() => {
            const a = document.createElement("a");
            a.href = selectedMedia.url;
            a.download = `snap-${Date.now()}`;
            a.click();
          }}
          title={selectedMedia.title}
        />
      )}
    </div>
  );
}

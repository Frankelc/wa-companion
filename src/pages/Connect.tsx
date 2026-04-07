import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, Key, Loader2, CheckCircle2, XCircle, Phone, RefreshCw, Ghost, LogIn, Shield, Play, Square, LogOut } from "lucide-react";
import { useWhatsApp } from "@/hooks/useWhatsApp";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const API_URL = import.meta.env.VITE_API_URL || "https://wa-companion.onrender.com";

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
};

const Connect = () => {
  const navigate = useNavigate();
  const { 
    status, 
    getQR, 
    getPairingCode, 
    isGettingQR, 
    isGettingPairingCode, 
    refetch,
    reconnect: manualReconnect,
    isReconnecting,
  } = useWhatsApp();
  const [activeMethod, setActiveMethod] = useState<'qr' | 'pairing' | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [showPhoneInput, setShowPhoneInput] = useState<boolean>(false);
  
  // Snap state
  const qc = useQueryClient();
  const [snapUser, setSnapUser] = useState("");
  const [snapPass, setSnapPass] = useState("");

  const { data: botStatus } = useQuery({
    queryKey: ["snap-status"],
    queryFn: snapApi.status,
    refetchInterval: 5000,
  });

  const isSnapConnected = botStatus?.data?.is_connected ?? false;
  const isSnapCapturing = botStatus?.data?.is_capturing ?? false;

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

  // Check if already connected
  useEffect(() => {
    if (status?.status === 'connected') {
      navigate('/dashboard');
    }
  }, [status?.status, navigate]);

  // Poll for QR code or pairing code when active
  useEffect(() => {
    if (activeMethod === 'qr' && status?.qrCode) {
      setQrCode(status.qrCode);
    }
    if (activeMethod === 'pairing' && status?.pairingCode) {
      setPairingCode(status.pairingCode);
    }
  }, [activeMethod, status?.qrCode, status?.pairingCode]);

  // Timeout for "connecting" status that's stuck (5 minutes max)
  useEffect(() => {
    if (status?.status === 'connecting') {
      const connectingStartTime = Date.now();
      const maxConnectingTime = 5 * 60 * 1000; // 5 minutes
      
      const timeoutCheck = setInterval(() => {
        const elapsed = Date.now() - connectingStartTime;
        if (elapsed > maxConnectingTime) {
          console.warn('[Connect] Connection stuck in "connecting" status for too long, resetting...');
          toast.error('La connexion prend trop de temps. Veuillez réessayer.');
          // Reset to disconnected
          setActiveMethod(null);
          setQrCode(null);
          setPairingCode(null);
          setShowPhoneInput(false);
          setPhoneNumber('');
        }
      }, 30000); // Check every 30 seconds

      return () => {
        clearInterval(timeoutCheck);
      };
    }
  }, [status?.status]);

  const handleQRCode = () => {
    if (activeMethod === 'pairing') {
      toast.error('Veuillez d\'abord arrêter la génération du code de couplage');
      return;
    }

    setActiveMethod('qr');
    setQrCode(null);
    getQR();
  };

  const handlePairingCode = () => {
    if (activeMethod === 'qr') {
      toast.error('Veuillez d\'abord arrêter la génération du code QR');
      return;
    }

    // Show phone input if not already shown
    if (!showPhoneInput) {
      setShowPhoneInput(true);
      return;
    }

    // Validate phone number
    if (!phoneNumber || phoneNumber.trim().length < 8) {
      toast.error('Veuillez entrer un numéro de téléphone valide');
      return;
    }

    setActiveMethod('pairing');
    setPairingCode(null);
    getPairingCode(phoneNumber.trim());
  };

  const handleStop = () => {
    setActiveMethod(null);
    setQrCode(null);
    setPairingCode(null);
    setShowPhoneInput(false);
    setPhoneNumber('');
    toast.info('Génération arrêtée');
    
    // Force refetch to update status
    refetch();
  };

  const showManualReconnect = Boolean(status?.hasSavedSession);
  const lastActivity = status?.lastSeen || status?.connectedAt;
  const lastActivityLabel = lastActivity
    ? new Date(lastActivity).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null;
  const manualReconnectDisabled = isReconnecting || status?.status === 'connecting';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl border-border">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center justify-between">
            <span>Association et Connexion</span>
            <div className="flex gap-2">
              <Badge variant={status?.status === 'connected' ? "default" : "outline"} className={status?.status === 'connected' ? "bg-green-500 hover:bg-green-600" : ""}>
                WA {status?.status === 'connected' ? "✓" : "×"}
              </Badge>
              <Badge variant={isSnapConnected ? "default" : "outline"} className={isSnapConnected ? "bg-yellow-500 hover:bg-yellow-600 text-yellow-950" : ""}>
                Snap {isSnapConnected ? "✓" : "×"}
              </Badge>
            </div>
          </CardTitle>
          <CardDescription>
            Reliez vos comptes sociaux pour activer l'automatisation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs defaultValue="whatsapp" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="whatsapp" className="gap-2">
                <Phone className="w-4 h-4" />
                WhatsApp
              </TabsTrigger>
              <TabsTrigger value="snapchat" className="gap-2">
                <Ghost className="w-4 h-4" />
                Snapchat
              </TabsTrigger>
            </TabsList>

            <TabsContent value="whatsapp" className="space-y-6">
              {/* Reconnect Method */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-gradient-to-r from-primary/5 to-transparent">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <RefreshCw className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Reconnecter automatiquement</h3>
                      <p className="text-sm text-muted-foreground text-xs sm:text-sm">
                        Utilise votre dernière session WA
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => manualReconnect()}
                    disabled={manualReconnectDisabled || !showManualReconnect}
                    variant={showManualReconnect ? 'default' : 'secondary'}
                    size="sm"
                    className="whitespace-nowrap"
                  >
                    {isReconnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ...
                      </>
                    ) : (
                      'Se reconnecter'
                    )}
                  </Button>
                </div>

                {!showManualReconnect && (
                  <div className="p-4 border border-dashed border-border rounded-lg bg-muted/40 text-sm text-muted-foreground">
                    Aucune session enregistrée.
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Nouvelle connexion</span>
                </div>
              </div>

              {/* QR Code Method */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <QrCode className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm sm:text-base">Code QR WhatsApp</h3>
                    </div>
                  </div>
                  <Button
                    onClick={handleQRCode}
                    disabled={activeMethod === 'pairing' || isGettingQR || isGettingPairingCode}
                    variant={activeMethod === 'qr' ? 'default' : 'outline'}
                    size="sm"
                  >
                    {(activeMethod === 'qr' || isGettingQR) ? 'En cours...' : 'Générer QR'}
                  </Button>
                </div>

                {activeMethod === 'qr' && qrCode && (
                  <div className="p-4 border border-border rounded-lg bg-muted/50 flex flex-col items-center gap-4">
                    <img src={qrCode} alt="QR Code" className="w-48 h-48 border-2 border-border rounded-lg" />
                    <Button variant="outline" size="sm" onClick={handleStop}>Arrêter</Button>
                  </div>
                )}
              </div>

              {/* Pairing Code Method */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Key className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm sm:text-base">Code de couplage</h3>
                    </div>
                  </div>
                  <Button
                    onClick={handlePairingCode}
                    disabled={activeMethod === 'qr' || isGettingQR || isGettingPairingCode}
                    variant={activeMethod === 'pairing' ? 'default' : 'outline'}
                    size="sm"
                  >
                    {(activeMethod === 'pairing' || isGettingPairingCode) ? 'En cours...' : 'Générer code'}
                  </Button>
                </div>

                {showPhoneInput && (
                  <div className="p-4 border border-border rounded-lg bg-muted/50 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Numéro</Label>
                      <div className="flex gap-2">
                        <Input id="phone" type="tel" placeholder="229XXXXXXXX" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} disabled={activeMethod === 'pairing'} className="flex-1 h-9" />
                        <Button onClick={handlePairingCode} disabled={!phoneNumber || activeMethod === 'pairing'} variant="outline" size="sm">
                          Go
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {activeMethod === 'pairing' && pairingCode && (
                  <div className="p-4 border border-border rounded-lg bg-muted/50 flex flex-col items-center gap-4">
                    <div className="text-2xl font-bold tracking-wider font-mono bg-background p-3 rounded-lg border-2 border-primary">
                      {pairingCode}
                    </div>
                    <Button variant="outline" size="sm" onClick={handleStop}>Arrêter</Button>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="snapchat" className="space-y-6">
              <div className="p-4 border border-border rounded-lg bg-yellow-500/10 border-yellow-500/20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-yellow-500/20 rounded-lg">
                    <Ghost className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Connexion Snapchat</h3>
                    <p className="text-xs text-muted-foreground text-sm">
                      Requis pour la capture silencieuse
                    </p>
                  </div>
                </div>

                {!isSnapConnected ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="snap-username">Nom d'utilisateur</Label>
                      <Input
                        id="snap-username"
                        placeholder="your_snap_username"
                        value={snapUser}
                        onChange={(e) => setSnapUser(e.target.value)}
                        className="h-9"
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
                        className="h-9"
                      />
                    </div>
                    <Button
                      className="w-full gap-2 bg-yellow-500 hover:bg-yellow-600 text-yellow-950 font-bold"
                      onClick={() => loginMut.mutate()}
                      disabled={loginMut.isPending || !snapUser || !snapPass}
                    >
                      <LogIn className="w-4 h-4" />
                      {loginMut.isPending ? "Connexion..." : "Se connecter"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border">
                      <Avatar className="h-9 w-9 bg-yellow-400">
                        <AvatarFallback className="bg-yellow-400 text-yellow-900 font-bold text-sm">👻</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Session Snapchat Active</p>
                        <Badge variant="outline" className="text-[10px] text-green-600 border-green-200 bg-green-50">Connecté</Badge>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => logoutMut.mutate()} disabled={logoutMut.isPending}>
                        <LogOut className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>

                    {!isSnapCapturing ? (
                      <Button
                        className="w-full gap-2 bg-yellow-500 hover:bg-yellow-600 text-yellow-950 font-bold"
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
                  </div>
                )}
              </div>

              <div className="p-4 rounded-lg bg-muted/40 border border-border/50">
                <h4 className="flex items-center gap-2 text-sm font-semibold mb-2">
                  <Shield className="w-4 h-4 text-primary" />
                  Sécurité et Confidentialité
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Vos identifiants Snapchat sont utilisés uniquement pour piloter une session Web temporaire sur nos serveurs. 
                  Nous ne stockons pas vos données en clair au-delà de la session active.
                  La capture est indétectable par l'expéditeur.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Back button */}
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="w-full text-muted-foreground text-xs"
          >
            Retour au tableau de bord
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Connect;


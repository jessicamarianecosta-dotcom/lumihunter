"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  signInWithPassword,
  signUp,
  signInWithMagicLink,
  resetPassword,
  signInWithGoogle,
  type AuthState,
} from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Aguarde…" : children}
    </Button>
  );
}

function Feedback({ state }: { state: AuthState }) {
  if (state.error)
    return <p className="text-sm text-destructive">{state.error}</p>;
  if (state.message)
    return <p className="text-sm text-emerald-600">{state.message}</p>;
  return null;
}

function GoogleButton() {
  return (
    <form action={signInWithGoogle}>
      <Button type="submit" variant="outline" className="w-full">
        Continuar com Google
      </Button>
    </form>
  );
}

export function LoginForm() {
  const [state, action] = useActionState(signInWithPassword, {});
  const [magicState, magicAction] = useActionState(signInWithMagicLink, {});
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Entrar</h1>
        <p className="text-sm text-muted-foreground">
          Acesse o painel do LumiHunter AI.
        </p>
      </div>
      <form action={action} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" name="password" type="password" required />
        </div>
        <Feedback state={state} />
        <SubmitButton>Entrar</SubmitButton>
      </form>

      <div className="relative text-center text-xs text-muted-foreground">
        <span className="bg-background px-2">ou</span>
        <div className="absolute inset-x-0 top-1/2 -z-10 h-px bg-border" />
      </div>

      <GoogleButton />

      <form action={magicAction} className="space-y-2">
        <Label htmlFor="magic-email" className="text-xs text-muted-foreground">
          Receber link mágico
        </Label>
        <div className="flex gap-2">
          <Input id="magic-email" name="email" type="email" placeholder="seu@email.com" />
          <Button type="submit" variant="secondary">
            Enviar
          </Button>
        </div>
        <Feedback state={magicState} />
      </form>

      <p className="text-sm text-muted-foreground">
        <Link href="/forgot-password" className="underline">
          Esqueci a senha
        </Link>{" "}
        ·{" "}
        <Link href="/signup" className="underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUp, {});
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Criar conta</h1>
        <p className="text-sm text-muted-foreground">
          Comece a prospectar em minutos.
        </p>
      </div>
      <form action={action} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="full_name">Nome completo</Label>
          <Input id="full_name" name="full_name" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
          />
        </div>
        <Feedback state={state} />
        <SubmitButton>Criar conta</SubmitButton>
      </form>
      <GoogleButton />
      <p className="text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/login" className="underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(resetPassword, {});
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Recuperar senha</h1>
        <p className="text-sm text-muted-foreground">
          Enviaremos um link para redefinir sua senha.
        </p>
      </div>
      <form action={action} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <Feedback state={state} />
        <SubmitButton>Enviar link</SubmitButton>
      </form>
      <p className="text-sm text-muted-foreground">
        <Link href="/login" className="underline">
          Voltar ao login
        </Link>
      </p>
    </div>
  );
}

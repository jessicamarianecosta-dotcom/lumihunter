"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { completeOnboarding, type OnboardingState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function Save() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="lg">
      {pending ? "Salvando…" : "Concluir e entrar"}
    </Button>
  );
}

export default function OnboardingPage() {
  const [state, action] = useActionState<OnboardingState, FormData>(
    completeOnboarding,
    {},
  );

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Bem-vindo ao LumiHunter AI</h1>
      <p className="mt-1 text-muted-foreground">
        Vamos configurar sua empresa. Você pode ajustar tudo depois.
      </p>

      <form action={action} className="mt-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Dados da empresa</CardTitle>
            <CardDescription>Usados pelos agentes de IA nas abordagens.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field name="name" label="Nome da empresa" required />
            <Field name="segment" label="Segmento" placeholder="Ex: Comunicação visual" />
            <Field name="cnpj" label="CNPJ" />
            <Field name="city" label="Cidade" />
            <Field name="state" label="Estado (UF)" maxLength={2} />
            <Field name="whatsapp" label="WhatsApp comercial" />
            <Field name="email" label="E-mail comercial" type="email" />
            <Field name="website" label="Site" placeholder="https://" />
            <Field name="instagram" label="Instagram" placeholder="@" />
            <div className="space-y-1.5">
              <Label htmlFor="brand_color">Cor principal</Label>
              <Input
                id="brand_color"
                name="brand_color"
                type="color"
                defaultValue="#F5C518"
                className="h-9 w-full p-1"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="description">O que sua empresa vende?</Label>
              <Textarea id="description" name="description" rows={3} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Primeiro produto (opcional)</CardTitle>
            <CardDescription>
              Cadastre mais produtos depois, em Produtos.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field name="product_name" label="Nome do produto" />
            <Field name="product_price" label="Preço médio (R$)" type="number" />
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="product_description">Descrição</Label>
              <Textarea id="product_description" name="product_description" rows={2} />
            </div>
            <Field
              name="product_keywords"
              label="Palavras-chave (separadas por vírgula)"
              className="sm:col-span-2"
            />
          </CardContent>
        </Card>

        {state.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        <Save />
      </form>
    </div>
  );
}

function Field({
  name,
  label,
  className,
  ...props
}: {
  name: string;
  label: string;
  className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}

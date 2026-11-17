import { cleanDigits } from "@/lib/validations/member.schema";

export type ViaCepResult =
  | {
      ok: true;
      logradouro: string;
      bairro: string;
      cidade: string;
      notice: string;
    }
  | {
      ok: false;
      notice: string;
    };

/**
 * Consulta o endereço pelo CEP via ViaCEP retornando feedback amigável de erro/sucesso.
 */
export async function fetchViaCepAddress(rawCep: string): Promise<ViaCepResult> {
  const digits = cleanDigits(rawCep);
  if (digits.length !== 8) {
    return {
      ok: false,
      notice: "Informe um CEP completo com 8 dígitos para buscar.",
    };
  }

  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) {
      return {
        ok: false,
        notice: "Não foi possível consultar o CEP agora. Preencha manualmente.",
      };
    }

    const data = (await res.json()) as {
      erro?: boolean;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
    };

    if (data.erro) {
      return {
        ok: false,
        notice: "CEP não encontrado. Preencha o endereço manualmente abaixo.",
      };
    }

    return {
      ok: true,
      logradouro: data.logradouro ?? "",
      bairro: data.bairro ?? "",
      cidade: data.localidade ?? "",
      notice: "Endereço preenchido pelo CEP. Confira e informe o número.",
    };
  } catch {
    return {
      ok: false,
      notice: "Falha ao consultar o CEP agora. Preencha o endereço manualmente.",
    };
  }
}

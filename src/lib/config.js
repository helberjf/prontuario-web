/** Tudo que é específico do hospital vem de public/: logo, dados, enfermarias, dietas e itens liberados. */
export async function carregarConfig() {
  const ler = async (caminho) => {
    const r = await fetch(caminho);
    if (!r.ok) throw new Error(`Não consegui carregar ${caminho}.`);
    return r.json();
  };
  const [hospital, enfermarias, dietas, prescricoes] = await Promise.all([
    ler('/hospital/hospital.json'), ler('/config/enfermarias.json'), ler('/config/dietas.json'), ler('/config/prescricoes.json'),
  ]);
  return { hospital, enfermarias, dietas, catalogos: prescricoes };
}

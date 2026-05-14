// xeokit-sdk publica .d.ts incompletos/quebrados. Como o uso real no
// hook useXeokit já trata o objeto Viewer como `any`, declaramos o módulo
// inteiro como `any` para que o tsc pare de reclamar dos tipos internos.

declare module '@xeokit/xeokit-sdk' {
  const xeokit: any
  export = xeokit
}

declare module '@xeokit/xeokit-convert/src/convert2xkt.js' {
  export const convert2xkt: (opts: any) => Promise<void>
}

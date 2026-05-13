/**
 * Códigos de erro centralizados. Sempre prefira usar um código tipado
 * em vez de uma string solta para que a mensagem fique consistente em
 * toda a UI.
 */
export type ErrorCode =
  // Viewer / WebGL
  | 'WEBGL2_UNSUPPORTED'
  | 'VIEWER_INIT_FAILED'
  | 'MODEL_LOAD_FAILED'
  // Upload
  | 'UPLOAD_UNSUPPORTED_FORMAT'
  | 'UPLOAD_NO_MODEL_IN_ZIP'
  | 'UPLOAD_READ_FAILED'
  | 'UPLOAD_PROCESS_FAILED'
  // Conversão IFC → XKT
  | 'CONVERT_FAILED'
  // Importação de progresso
  | 'IMPORT_INVALID_JSON'
  // Registro de progresso
  | 'PHOTO_REQUIRED_TO_COMPLETE'
  // Autenticação
  | 'AUTH_MISSING_FIELDS'
  | 'AUTH_PASSWORD_MISMATCH'
  | 'AUTH_PASSWORD_TOO_SHORT'
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_USERNAME_TAKEN'
  | 'AUTH_EMAIL_TAKEN_OR_INVALID'
  | 'AUTH_UNEXPECTED'
  // Genérico
  | 'UNKNOWN'

export interface ErrorContent {
  title:   string
  description: string
  hint?:   string
}

/** Mensagens em PT-BR — única fonte da verdade para textos de erro. */
const PT_BR: Record<ErrorCode, ErrorContent> = {
  WEBGL2_UNSUPPORTED: {
    title:       'Seu navegador não suporta WebGL2',
    description: 'O visualizador 3D precisa de WebGL2 para renderizar o modelo. O navegador atual está caindo em WebGL1 e o shader falhou ao compilar.',
    hint:        'Atualize o navegador para a versão mais recente, habilite "aceleração de hardware" nas configurações e verifique se os drivers da placa de vídeo estão atualizados. Em alguns notebooks é preciso forçar o uso da GPU dedicada.',
  },
  VIEWER_INIT_FAILED: {
    title:       'Falha ao iniciar o visualizador 3D',
    description: 'Não foi possível inicializar o motor de renderização.',
    hint:        'Recarregue a página. Se o erro persistir, tente outro navegador (Chrome ou Edge recentes).',
  },
  MODEL_LOAD_FAILED: {
    title:       'Falha ao carregar o modelo',
    description: 'O arquivo BIM foi lido mas não pôde ser exibido no visualizador.',
    hint:        'Verifique se o arquivo não está corrompido. Para IFC muito grandes, converta para XKT primeiro.',
  },

  UPLOAD_UNSUPPORTED_FORMAT: {
    title:       'Formato não suportado',
    description: 'Apenas arquivos .ifc, .xkt, .bim ou .zip podem ser carregados.',
  },
  UPLOAD_NO_MODEL_IN_ZIP: {
    title:       'Nenhum modelo encontrado',
    description: 'O arquivo compactado não contém um .ifc ou .xkt.',
  },
  UPLOAD_READ_FAILED: {
    title:       'Falha ao ler o arquivo',
    description: 'Não foi possível ler o conteúdo do arquivo selecionado.',
  },
  UPLOAD_PROCESS_FAILED: {
    title:       'Erro ao processar o arquivo',
    description: 'Ocorreu uma falha ao preparar o modelo para visualização.',
  },

  CONVERT_FAILED: {
    title:       'Falha na conversão',
    description: 'O servidor não conseguiu converter o IFC para XKT.',
    hint:        'Tente novamente em alguns segundos. Arquivos muito grandes podem ultrapassar o limite de tempo do servidor.',
  },

  IMPORT_INVALID_JSON: {
    title:       'Arquivo inválido',
    description: 'O arquivo selecionado não é um JSON de progresso válido.',
  },

  PHOTO_REQUIRED_TO_COMPLETE: {
    title:       'Foto é obrigatória para concluir',
    description: 'Anexe uma foto do elemento antes de marcar como Concluído.',
    hint:        'Use o botão Câmera ou Galeria abaixo. A foto fica vinculada ao registro e ajuda auditorias futuras.',
  },

  AUTH_MISSING_FIELDS: {
    title:       'Preencha todos os campos',
    description: 'Informe usuário e senha para continuar.',
  },
  AUTH_PASSWORD_MISMATCH: {
    title:       'Senhas não conferem',
    description: 'A confirmação precisa ser idêntica à senha.',
  },
  AUTH_PASSWORD_TOO_SHORT: {
    title:       'Senha muito curta',
    description: 'Use no mínimo 6 caracteres.',
  },
  AUTH_INVALID_CREDENTIALS: {
    title:       'Usuário ou senha incorretos',
    description: 'Verifique os dados e tente novamente.',
  },
  AUTH_USERNAME_TAKEN: {
    title:       'Nome de usuário já existe',
    description: 'Escolha outro nome de usuário para criar a conta.',
  },
  AUTH_EMAIL_TAKEN_OR_INVALID: {
    title:       'Não foi possível criar a conta',
    description: 'O email já está cadastrado ou é inválido.',
  },
  AUTH_UNEXPECTED: {
    title:       'Erro inesperado',
    description: 'Algo deu errado ao processar a requisição. Tente novamente.',
  },

  UNKNOWN: {
    title:       'Algo deu errado',
    description: 'Ocorreu um erro inesperado.',
  },
}

const EN: Record<ErrorCode, ErrorContent> = {
  WEBGL2_UNSUPPORTED: {
    title:       'Your browser does not support WebGL2',
    description: 'The 3D viewer needs WebGL2 to render the model. The current browser is falling back to WebGL1 and the shader failed to compile.',
    hint:        'Update the browser to the latest version, enable "hardware acceleration" in settings and check if your GPU drivers are up to date. On some laptops you may need to force the discrete GPU.',
  },
  VIEWER_INIT_FAILED: {
    title:       'Failed to start the 3D viewer',
    description: 'The rendering engine could not be initialized.',
    hint:        'Reload the page. If the error persists, try a recent Chrome or Edge.',
  },
  MODEL_LOAD_FAILED: {
    title:       'Failed to load model',
    description: 'The BIM file was read but could not be displayed.',
    hint:        'Make sure the file is not corrupted. For very large IFCs, convert to XKT first.',
  },

  UPLOAD_UNSUPPORTED_FORMAT: {
    title:       'Unsupported format',
    description: 'Only .ifc, .xkt, .bim or .zip files can be loaded.',
  },
  UPLOAD_NO_MODEL_IN_ZIP: {
    title:       'No model found',
    description: 'The archive does not contain an .ifc or .xkt file.',
  },
  UPLOAD_READ_FAILED: {
    title:       'Failed to read file',
    description: 'Could not read the selected file.',
  },
  UPLOAD_PROCESS_FAILED: {
    title:       'Error processing file',
    description: 'Something went wrong while preparing the model.',
  },

  CONVERT_FAILED: {
    title:       'Conversion failed',
    description: 'The server could not convert the IFC into XKT.',
    hint:        'Try again. Very large files may hit the server timeout.',
  },

  IMPORT_INVALID_JSON: {
    title:       'Invalid file',
    description: 'The selected file is not a valid progress JSON.',
  },

  PHOTO_REQUIRED_TO_COMPLETE: {
    title:       'Photo required to complete',
    description: 'Attach a photo of the element before marking it as Completed.',
    hint:        'Use the Camera or Gallery button below. The photo stays linked to the record for audit purposes.',
  },

  AUTH_MISSING_FIELDS: {
    title:       'Fill in all fields',
    description: 'Enter username and password to continue.',
  },
  AUTH_PASSWORD_MISMATCH: {
    title:       'Passwords do not match',
    description: 'The confirmation must match the password.',
  },
  AUTH_PASSWORD_TOO_SHORT: {
    title:       'Password too short',
    description: 'Use at least 6 characters.',
  },
  AUTH_INVALID_CREDENTIALS: {
    title:       'Wrong username or password',
    description: 'Check your credentials and try again.',
  },
  AUTH_USERNAME_TAKEN: {
    title:       'Username already taken',
    description: 'Pick a different username to create the account.',
  },
  AUTH_EMAIL_TAKEN_OR_INVALID: {
    title:       'Could not create account',
    description: 'The email is already registered or is invalid.',
  },
  AUTH_UNEXPECTED: {
    title:       'Unexpected error',
    description: 'Something went wrong. Please try again.',
  },

  UNKNOWN: {
    title:       'Something went wrong',
    description: 'An unexpected error occurred.',
  },
}

const MESSAGES: Record<'pt-BR' | 'en', Record<ErrorCode, ErrorContent>> = {
  'pt-BR': PT_BR,
  en:      EN,
}

function currentLocale(): 'pt-BR' | 'en' {
  if (typeof document === 'undefined') return 'pt-BR'
  const l = document.documentElement.lang
  return l?.toLowerCase().startsWith('en') ? 'en' : 'pt-BR'
}

export class AppError extends Error {
  readonly code:   ErrorCode
  readonly detail: string | undefined

  constructor(code: ErrorCode, detail?: string) {
    super(code)
    this.name   = 'AppError'
    this.code   = code
    this.detail = detail
  }
}

/** Retorna `{title, description, hint?}` para o código informado. */
export function getErrorContent(code: ErrorCode, locale?: 'pt-BR' | 'en'): ErrorContent {
  const dict = MESSAGES[locale ?? currentLocale()]
  return dict[code] ?? dict.UNKNOWN
}

/** Normaliza qualquer erro em AppError. Preserva código se já for AppError. */
export function toAppError(err: unknown, fallback: ErrorCode = 'UNKNOWN'): AppError {
  if (err instanceof AppError) return err
  const detail = err instanceof Error ? err.message
    : typeof err === 'string'         ? err
    : err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : undefined
  return new AppError(fallback, detail)
}

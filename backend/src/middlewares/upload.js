/*
 * Recebe um único arquivo no campo "arquivo" (em memória), filtrando a extensão
 * e traduzindo os erros do multer em mensagens claras.
 */
const multer = require("multer");
const { Erros } = require("../lib/erros");

function receberArquivo({ extensoes, tamanhoMaximoMb, mensagemExtensao }) {
  const padrao = new RegExp(`\\.(${extensoes.join("|")})$`, "i");
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: tamanhoMaximoMb * 1024 * 1024, files: 1 },
    fileFilter: (_req, arquivo, cb) => {
      const aceito = padrao.test(arquivo.originalname);
      cb(aceito ? null : Erros.requisicaoInvalida(mensagemExtensao), aceito);
    },
  });

  return (req, res, next) => {
    upload.single("arquivo")(req, res, (erro) => {
      if (!erro) {
        if (!req.file) return next(Erros.requisicaoInvalida('Envie o arquivo no campo "arquivo".'));
        // multer lê o nome como Latin-1; navegadores mandam UTF-8.
        req.file.originalname = Buffer.from(req.file.originalname, "latin1").toString("utf8");
        return next();
      }
      if (erro instanceof multer.MulterError) {
        const mensagem =
          erro.code === "LIMIT_FILE_SIZE"
            ? `Arquivo maior que ${tamanhoMaximoMb} MB.`
            : `Envie um único arquivo no campo "arquivo" (${erro.code}).`;
        return next(Erros.requisicaoInvalida(mensagem));
      }
      return next(erro);
    });
  };
}

module.exports = { receberArquivo };

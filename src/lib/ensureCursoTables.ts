import { prisma } from './prisma'

let setupPromise: Promise<void> | null = null

/** Cria somente as tabelas próprias do módulo; CLIENTEs e Segmento continuam sendo legadas. */
export function ensureCursoTables() {
  if (!setupPromise) {
    setupPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        IF OBJECT_ID(N'dbo.CursoCatalogo', N'U') IS NULL
        CREATE TABLE dbo.CursoCatalogo (
          CursoId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          Codigo NVARCHAR(40) NULL,
          Nome NVARCHAR(160) NOT NULL,
          Descricao NVARCHAR(1200) NULL,
          CargaHoraria DECIMAL(8,2) NULL,
          PublicoAlvo NVARCHAR(300) NULL,
          Status NVARCHAR(20) NOT NULL CONSTRAINT DF_CursoCatalogo_Status DEFAULT N'ATIVO',
          CriadoEm DATETIME2 NOT NULL CONSTRAINT DF_CursoCatalogo_CriadoEm DEFAULT SYSUTCDATETIME(),
          AtualizadoEm DATETIME2 NOT NULL CONSTRAINT DF_CursoCatalogo_AtualizadoEm DEFAULT SYSUTCDATETIME()
        );
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_CursoCatalogo_Codigo' AND object_id = OBJECT_ID(N'dbo.CursoCatalogo'))
          CREATE UNIQUE INDEX UX_CursoCatalogo_Codigo ON dbo.CursoCatalogo(Codigo) WHERE Codigo IS NOT NULL;

        IF COL_LENGTH(N'dbo.CursoCatalogo',N'PercentualMinimoAprovacao') IS NULL
          ALTER TABLE dbo.CursoCatalogo ADD PercentualMinimoAprovacao DECIMAL(5,2) NULL
            CONSTRAINT CK_CursoCatalogo_PercentualAprovacao CHECK (PercentualMinimoAprovacao BETWEEN 0 AND 100);

        IF OBJECT_ID(N'dbo.CursoVersao', N'U') IS NULL
        CREATE TABLE dbo.CursoVersao (
          VersaoId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          CursoId INT NOT NULL,
          NumeroVersao INT NOT NULL,
          Titulo NVARCHAR(160) NOT NULL,
          VigenteDesde DATE NULL,
          CriadoEm DATETIME2 NOT NULL CONSTRAINT DF_CursoVersao_CriadoEm DEFAULT SYSUTCDATETIME(),
          CONSTRAINT FK_CursoVersao_Curso FOREIGN KEY (CursoId) REFERENCES dbo.CursoCatalogo(CursoId),
          CONSTRAINT UQ_CursoVersao_Numero UNIQUE (CursoId, NumeroVersao)
        );

        IF OBJECT_ID(N'dbo.CursoModulo', N'U') IS NULL
        CREATE TABLE dbo.CursoModulo (
          ModuloId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          VersaoId INT NOT NULL,
          Titulo NVARCHAR(180) NOT NULL,
          Descricao NVARCHAR(1000) NULL,
          Ordem INT NOT NULL CONSTRAINT DF_CursoModulo_Ordem DEFAULT 0,
          CONSTRAINT FK_CursoModulo_Versao FOREIGN KEY (VersaoId) REFERENCES dbo.CursoVersao(VersaoId)
        );

        IF OBJECT_ID(N'dbo.CursoTopico', N'U') IS NULL
        CREATE TABLE dbo.CursoTopico (
          TopicoId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          ModuloId INT NOT NULL,
          Titulo NVARCHAR(200) NOT NULL,
          Descricao NVARCHAR(1500) NULL,
          CargaHoraria DECIMAL(8,2) NULL,
          MaterialUrl NVARCHAR(1000) NULL,
          Ordem INT NOT NULL CONSTRAINT DF_CursoTopico_Ordem DEFAULT 0,
          CONSTRAINT FK_CursoTopico_Modulo FOREIGN KEY (ModuloId) REFERENCES dbo.CursoModulo(ModuloId)
        );

        IF OBJECT_ID(N'dbo.CursoVinculo', N'U') IS NULL
        CREATE TABLE dbo.CursoVinculo (
          VinculoId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          CodCli INT NOT NULL,
          CursoId INT NOT NULL,
          VersaoId INT NOT NULL,
          Situacao NVARCHAR(20) NOT NULL CONSTRAINT DF_CursoVinculo_Situacao DEFAULT N'ATIVO',
          VinculadoEm DATE NOT NULL CONSTRAINT DF_CursoVinculo_VinculadoEm DEFAULT CONVERT(date, GETDATE()),
          ConcluidoEm DATE NULL,
          Observacao NVARCHAR(1000) NULL,
          CriadoEm DATETIME2 NOT NULL CONSTRAINT DF_CursoVinculo_CriadoEm DEFAULT SYSUTCDATETIME(),
          CONSTRAINT FK_CursoVinculo_Curso FOREIGN KEY (CursoId) REFERENCES dbo.CursoCatalogo(CursoId),
          CONSTRAINT FK_CursoVinculo_Versao FOREIGN KEY (VersaoId) REFERENCES dbo.CursoVersao(VersaoId)
        );
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_CursoVinculo_CodCli' AND object_id = OBJECT_ID(N'dbo.CursoVinculo'))
          CREATE INDEX IX_CursoVinculo_CodCli ON dbo.CursoVinculo(CodCli, Situacao);

        IF OBJECT_ID(N'dbo.CursoNota', N'U') IS NULL
        CREATE TABLE dbo.CursoNota (
          NotaId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          VinculoId INT NOT NULL,
          Avaliacao NVARCHAR(160) NOT NULL,
          Nota DECIMAL(8,2) NULL,
          Conceito NVARCHAR(100) NULL,
          Situacao NVARCHAR(20) NOT NULL CONSTRAINT DF_CursoNota_Situacao DEFAULT N'LANÇADA',
          DataAvaliacao DATE NULL,
          Observacao NVARCHAR(1000) NULL,
          AtualizadoEm DATETIME2 NOT NULL CONSTRAINT DF_CursoNota_AtualizadoEm DEFAULT SYSUTCDATETIME(),
          CONSTRAINT FK_CursoNota_Vinculo FOREIGN KEY (VinculoId) REFERENCES dbo.CursoVinculo(VinculoId)
        );

        IF OBJECT_ID(N'dbo.CursoAuditoria', N'U') IS NULL
        CREATE TABLE dbo.CursoAuditoria (
          AuditoriaId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          AtorId INT NULL,
          AtorPerfil NVARCHAR(30) NULL,
          Acao NVARCHAR(60) NOT NULL,
          Entidade NVARCHAR(60) NOT NULL,
          EntidadeId INT NULL,
          Detalhes NVARCHAR(MAX) NULL,
          CriadoEm DATETIME2 NOT NULL CONSTRAINT DF_CursoAuditoria_CriadoEm DEFAULT SYSUTCDATETIME()
        );

        IF OBJECT_ID(N'dbo.CursoAcesso', N'U') IS NULL
        CREATE TABLE dbo.CursoAcesso (
          CodCli INT NOT NULL PRIMARY KEY,
          HashSenha VARBINARY(64) NOT NULL,
          Salt VARBINARY(32) NOT NULL,
          PrecisaTrocarSenha BIT NOT NULL CONSTRAINT DF_CursoAcesso_Troca DEFAULT 1,
          Tentativas INT NOT NULL CONSTRAINT DF_CursoAcesso_Tentativas DEFAULT 0,
          BloqueadoAte DATETIME2 NULL,
          AtualizadoEm DATETIME2 NOT NULL CONSTRAINT DF_CursoAcesso_AtualizadoEm DEFAULT SYSUTCDATETIME()
        );

        IF OBJECT_ID(N'dbo.CursoTurma', N'U') IS NULL
        CREATE TABLE dbo.CursoTurma (
          TurmaId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          CursoId INT NOT NULL, VersaoId INT NOT NULL, Codigo NVARCHAR(40) NULL, Nome NVARCHAR(160) NOT NULL,
          Status NVARCHAR(20) NOT NULL CONSTRAINT DF_CursoTurma_Status DEFAULT N'PLANEJADA',
          DataInicio DATE NULL, DataFim DATE NULL, Turno NVARCHAR(30) NULL, Horario NVARCHAR(120) NULL,
          Modalidade NVARCHAR(30) NULL, Local NVARCHAR(200) NULL, Vagas INT NULL,
          InscricaoInicio DATE NULL, InscricaoFim DATE NULL, CargaHoraria DECIMAL(8,2) NULL,
          NotaMinima DECIMAL(8,2) NULL, FrequenciaMinima DECIMAL(5,2) NULL,
          CriadoEm DATETIME2 NOT NULL CONSTRAINT DF_CursoTurma_CriadoEm DEFAULT SYSUTCDATETIME(),
          CONSTRAINT FK_CursoTurma_Curso FOREIGN KEY (CursoId) REFERENCES dbo.CursoCatalogo(CursoId),
          CONSTRAINT FK_CursoTurma_Versao FOREIGN KEY (VersaoId) REFERENCES dbo.CursoVersao(VersaoId)
        );
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_CursoTurma_Curso' AND object_id=OBJECT_ID(N'dbo.CursoTurma'))
          CREATE INDEX IX_CursoTurma_Curso ON dbo.CursoTurma(CursoId,Status,DataInicio);

        IF COL_LENGTH(N'dbo.CursoVinculo',N'TurmaId') IS NULL ALTER TABLE dbo.CursoVinculo ADD TurmaId INT NULL;
        IF COL_LENGTH(N'dbo.CursoVinculo',N'MatriculaCodigo') IS NULL ALTER TABLE dbo.CursoVinculo ADD MatriculaCodigo NVARCHAR(40) NULL;
        IF COL_LENGTH(N'dbo.CursoVinculo',N'ResultadoFinal') IS NULL ALTER TABLE dbo.CursoVinculo ADD ResultadoFinal NVARCHAR(20) NULL;
        IF COL_LENGTH(N'dbo.CursoVinculo',N'ResultadoEm') IS NULL ALTER TABLE dbo.CursoVinculo ADD ResultadoEm DATETIME2 NULL;
        IF COL_LENGTH(N'dbo.CursoVinculo',N'ResultadoPor') IS NULL ALTER TABLE dbo.CursoVinculo ADD ResultadoPor INT NULL;
        UPDATE dbo.CursoVinculo SET MatriculaCodigo=CONCAT(N'SC-',VinculoId) WHERE MatriculaCodigo IS NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'UX_CursoVinculo_Matricula' AND object_id=OBJECT_ID(N'dbo.CursoVinculo'))
          CREATE UNIQUE INDEX UX_CursoVinculo_Matricula ON dbo.CursoVinculo(MatriculaCodigo) WHERE MatriculaCodigo IS NOT NULL;
        IF EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'UX_CursoVinculo_VersaoAtiva' AND object_id=OBJECT_ID(N'dbo.CursoVinculo'))
          AND NOT EXISTS (SELECT 1 FROM sys.index_columns ic JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id WHERE ic.object_id=OBJECT_ID(N'dbo.CursoVinculo') AND ic.index_id=INDEXPROPERTY(OBJECT_ID(N'dbo.CursoVinculo'),N'UX_CursoVinculo_VersaoAtiva','IndexID') AND c.name=N'TurmaId' AND ic.key_ordinal=4)
          DROP INDEX UX_CursoVinculo_VersaoAtiva ON dbo.CursoVinculo;
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'UX_CursoVinculo_VersaoAtiva' AND object_id=OBJECT_ID(N'dbo.CursoVinculo'))
          CREATE UNIQUE INDEX UX_CursoVinculo_VersaoAtiva ON dbo.CursoVinculo(CodCli,CursoId,VersaoId,TurmaId) WHERE Situacao<>N'CANCELADO';
        IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name=N'FK_CursoVinculo_Turma')
          ALTER TABLE dbo.CursoVinculo ADD CONSTRAINT FK_CursoVinculo_Turma FOREIGN KEY (TurmaId) REFERENCES dbo.CursoTurma(TurmaId);

        IF OBJECT_ID(N'dbo.CursoInstrutor', N'U') IS NULL
        CREATE TABLE dbo.CursoInstrutor (
          InstrutorId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          CodCli INT NOT NULL, Especialidade NVARCHAR(200) NULL, RegistroProfissional NVARCHAR(100) NULL,
          Status NVARCHAR(20) NOT NULL CONSTRAINT DF_CursoInstrutor_Status DEFAULT N'ATIVO',
          CriadoEm DATETIME2 NOT NULL CONSTRAINT DF_CursoInstrutor_CriadoEm DEFAULT SYSUTCDATETIME(),
          CONSTRAINT UQ_CursoInstrutor_CodCli UNIQUE(CodCli)
        );
        IF OBJECT_ID(N'dbo.CursoTurmaInstrutor', N'U') IS NULL
        CREATE TABLE dbo.CursoTurmaInstrutor (
          TurmaInstrutorId INT IDENTITY(1,1) NOT NULL PRIMARY KEY, TurmaId INT NOT NULL, InstrutorId INT NOT NULL, ModuloId INT NULL,
          CONSTRAINT FK_CursoTurmaInstrutor_Turma FOREIGN KEY(TurmaId) REFERENCES dbo.CursoTurma(TurmaId),
          CONSTRAINT FK_CursoTurmaInstrutor_Instrutor FOREIGN KEY(InstrutorId) REFERENCES dbo.CursoInstrutor(InstrutorId)
        );

        IF OBJECT_ID(N'dbo.CursoAula', N'U') IS NULL
        CREATE TABLE dbo.CursoAula (
          AulaId INT IDENTITY(1,1) NOT NULL PRIMARY KEY, TurmaId INT NOT NULL, ModuloId INT NULL,
          Titulo NVARCHAR(200) NOT NULL, Inicio DATETIME2 NOT NULL, Fim DATETIME2 NULL,
          CargaHoraria DECIMAL(8,2) NULL, Local NVARCHAR(200) NULL, Status NVARCHAR(20) NOT NULL CONSTRAINT DF_CursoAula_Status DEFAULT N'PROGRAMADA', Observacao NVARCHAR(500) NULL,
          CONSTRAINT FK_CursoAula_Turma FOREIGN KEY(TurmaId) REFERENCES dbo.CursoTurma(TurmaId)
        );
        IF OBJECT_ID(N'dbo.CursoFrequencia', N'U') IS NULL
        CREATE TABLE dbo.CursoFrequencia (
          FrequenciaId INT IDENTITY(1,1) NOT NULL PRIMARY KEY, AulaId INT NOT NULL, VinculoId INT NOT NULL,
          Situacao NVARCHAR(20) NOT NULL, Justificativa NVARCHAR(500) NULL, AtualizadoPor INT NULL,
          AtualizadoEm DATETIME2 NOT NULL CONSTRAINT DF_CursoFrequencia_AtualizadoEm DEFAULT SYSUTCDATETIME(),
          CONSTRAINT FK_CursoFrequencia_Aula FOREIGN KEY(AulaId) REFERENCES dbo.CursoAula(AulaId),
          CONSTRAINT FK_CursoFrequencia_Vinculo FOREIGN KEY(VinculoId) REFERENCES dbo.CursoVinculo(VinculoId),
          CONSTRAINT UQ_CursoFrequencia_AulaVinculo UNIQUE(AulaId,VinculoId)
        );

        IF OBJECT_ID(N'dbo.CursoDocumento', N'U') IS NULL
        CREATE TABLE dbo.CursoDocumento (
          DocumentoId INT IDENTITY(1,1) NOT NULL PRIMARY KEY, VinculoId INT NOT NULL,
          Tipo NVARCHAR(100) NOT NULL, Status NVARCHAR(20) NOT NULL CONSTRAINT DF_CursoDocumento_Status DEFAULT N'PENDENTE',
          RecebidoEm DATE NULL, Observacao NVARCHAR(500) NULL, CriadoEm DATETIME2 NOT NULL CONSTRAINT DF_CursoDocumento_CriadoEm DEFAULT SYSUTCDATETIME(),
          CONSTRAINT FK_CursoDocumento_Vinculo FOREIGN KEY(VinculoId) REFERENCES dbo.CursoVinculo(VinculoId)
        );
        IF OBJECT_ID(N'dbo.CursoCertificado', N'U') IS NULL
        CREATE TABLE dbo.CursoCertificado (
          CertificadoId INT IDENTITY(1,1) NOT NULL PRIMARY KEY, VinculoId INT NOT NULL,
          CodigoValidacao NVARCHAR(64) NOT NULL, EmitidoEm DATETIME2 NOT NULL CONSTRAINT DF_CursoCertificado_EmitidoEm DEFAULT SYSUTCDATETIME(),
          EmitidoPor INT NULL, CanceladoEm DATETIME2 NULL, MotivoCancelamento NVARCHAR(500) NULL,
          CONSTRAINT FK_CursoCertificado_Vinculo FOREIGN KEY(VinculoId) REFERENCES dbo.CursoVinculo(VinculoId),
          CONSTRAINT UQ_CursoCertificado_Codigo UNIQUE(CodigoValidacao)
        );
        IF OBJECT_ID(N'dbo.CursoComunicado', N'U') IS NULL
        CREATE TABLE dbo.CursoComunicado (
          ComunicadoId INT IDENTITY(1,1) NOT NULL PRIMARY KEY, TurmaId INT NULL,
          Titulo NVARCHAR(180) NOT NULL, Mensagem NVARCHAR(2000) NOT NULL, Publicado BIT NOT NULL CONSTRAINT DF_CursoComunicado_Publicado DEFAULT 0,
          PublicadoEm DATETIME2 NULL, CriadoPor INT NULL, CriadoEm DATETIME2 NOT NULL CONSTRAINT DF_CursoComunicado_CriadoEm DEFAULT SYSUTCDATETIME(),
          CONSTRAINT FK_CursoComunicado_Turma FOREIGN KEY(TurmaId) REFERENCES dbo.CursoTurma(TurmaId)
        );

        IF COL_LENGTH(N'dbo.CursoNota',N'Peso') IS NULL ALTER TABLE dbo.CursoNota ADD Peso DECIMAL(8,2) NULL;
        IF COL_LENGTH(N'dbo.CursoNota',N'NotaMaxima') IS NULL ALTER TABLE dbo.CursoNota ADD NotaMaxima DECIMAL(8,2) NULL;

        IF OBJECT_ID(N'dbo.CursoProfissional', N'U') IS NULL
        CREATE TABLE dbo.CursoProfissional (
          CodUsu INT NOT NULL PRIMARY KEY,
          Perfil NVARCHAR(30) NOT NULL CONSTRAINT CK_CursoProfissional_Perfil CHECK (Perfil IN (N'ADMIN',N'SUPERVISOR',N'COORDENADORA',N'TEORICA',N'PRATICA')),
          Ativo BIT NOT NULL DEFAULT 1,
          AtualizadoEm DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
        );
        IF OBJECT_ID(N'dbo.CursoProfissionalTurma', N'U') IS NULL
        CREATE TABLE dbo.CursoProfissionalTurma (
          CodUsu INT NOT NULL, TurmaId INT NOT NULL,
          PRIMARY KEY (CodUsu,TurmaId),
          FOREIGN KEY (CodUsu) REFERENCES dbo.CursoProfissional(CodUsu),
          FOREIGN KEY (TurmaId) REFERENCES dbo.CursoTurma(TurmaId)
        );
        IF COL_LENGTH(N'dbo.CursoNota',N'Etapa') IS NULL
          ALTER TABLE dbo.CursoNota ADD Etapa NVARCHAR(20) NULL;
        IF COL_LENGTH(N'dbo.CursoNota',N'AvaliadorId') IS NULL
          ALTER TABLE dbo.CursoNota ADD AvaliadorId INT NULL;
      `)
      await prisma.$executeRawUnsafe(`
        DECLARE @roleConstraint sysname;
        SELECT TOP 1 @roleConstraint=name FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.CursoProfissional') AND definition LIKE N'%Perfil%' AND definition NOT LIKE N'%ADMIN%';
        IF @roleConstraint IS NOT NULL BEGIN
          DECLARE @roleSql NVARCHAR(500)=N'ALTER TABLE dbo.CursoProfissional DROP CONSTRAINT '+QUOTENAME(@roleConstraint);
          EXEC sp_executesql @roleSql;
        END;
        IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.CursoProfissional') AND definition LIKE N'%ADMIN%')
          ALTER TABLE dbo.CursoProfissional ADD CONSTRAINT CK_CursoProfissional_Perfil CHECK (Perfil IN(N'ADMIN',N'SUPERVISOR',N'COORDENADORA',N'TEORICA',N'PRATICA'));
        IF COL_LENGTH(N'dbo.CursoAcesso',N'SessionVersion') IS NULL ALTER TABLE dbo.CursoAcesso ADD SessionVersion INT NOT NULL DEFAULT 1;
        IF COL_LENGTH(N'dbo.CursoProfissional',N'SessionVersion') IS NULL ALTER TABLE dbo.CursoProfissional ADD SessionVersion INT NOT NULL DEFAULT 1;
        IF COL_LENGTH(N'dbo.CursoProfissional',N'CodCli') IS NULL ALTER TABLE dbo.CursoProfissional ADD CodCli INT NULL;
        IF COL_LENGTH(N'dbo.CursoProfissional',N'HashSenha') IS NULL ALTER TABLE dbo.CursoProfissional ADD HashSenha VARBINARY(64) NULL,Salt VARBINARY(32) NULL;
        IF COL_LENGTH(N'dbo.CursoProfissional',N'Tentativas') IS NULL ALTER TABLE dbo.CursoProfissional ADD Tentativas INT NOT NULL DEFAULT 0,BloqueadoAte DATETIME2 NULL;
        IF COL_LENGTH(N'dbo.CursoCatalogo',N'AvaliacaoConfig') IS NULL ALTER TABLE dbo.CursoCatalogo ADD AvaliacaoConfig NVARCHAR(MAX) NULL;
        IF COL_LENGTH(N'dbo.CursoCatalogo',N'PoliticaVersao') IS NULL ALTER TABLE dbo.CursoCatalogo ADD PoliticaVersao INT NOT NULL DEFAULT 1;
        IF COL_LENGTH(N'dbo.CursoVinculo',N'PoliticaSnapshot') IS NULL ALTER TABLE dbo.CursoVinculo ADD PoliticaSnapshot NVARCHAR(MAX) NULL;
        IF COL_LENGTH(N'dbo.CursoVinculo',N'Aptidao') IS NULL ALTER TABLE dbo.CursoVinculo ADD Aptidao NVARCHAR(30) NULL,AptidaoParecer NVARCHAR(2000) NULL,AptidaoPor INT NULL,AptidaoEm DATETIME2 NULL;
        IF COL_LENGTH(N'dbo.CursoNota',N'Criterios') IS NULL ALTER TABLE dbo.CursoNota ADD Criterios NVARCHAR(MAX) NULL;
        IF COL_LENGTH(N'dbo.CursoCertificado',N'DadosDocumento') IS NULL ALTER TABLE dbo.CursoCertificado ADD DadosDocumento NVARCHAR(MAX) NULL;
        IF OBJECT_ID(N'dbo.CursoEtapa',N'U') IS NULL CREATE TABLE dbo.CursoEtapa(
          VinculoId INT NOT NULL,Etapa NVARCHAR(20) NOT NULL,Status NVARCHAR(30) NOT NULL,
          Parecer NVARCHAR(2000) NULL,AtualizadoPor INT NOT NULL,AtualizadoEm DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
          PRIMARY KEY(VinculoId,Etapa),FOREIGN KEY(VinculoId) REFERENCES dbo.CursoVinculo(VinculoId),
          CHECK(Etapa IN(N'TEORICA',N'PRATICA',N'FINAL')),CHECK(Status IN(N'EM_ANDAMENTO',N'APROVADA',N'RECUPERACAO',N'REPROVADA'))
        );
        IF OBJECT_ID(N'dbo.CursoConfiguracao',N'U') IS NULL CREATE TABLE dbo.CursoConfiguracao(
          Id INT NOT NULL PRIMARY KEY CHECK(Id=1),Instituicao NVARCHAR(160) NOT NULL,
          Assinante NVARCHAR(160) NULL,CargoAssinante NVARCHAR(100) NULL,AtualizadoEm DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
        );
        IF NOT EXISTS(SELECT 1 FROM dbo.CursoConfiguracao WHERE Id=1) INSERT dbo.CursoConfiguracao(Id,Instituicao) VALUES(1,N'Cuida Amor');
        IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'UX_CursoCertificado_Ativo' AND object_id=OBJECT_ID(N'dbo.CursoCertificado'))
          AND NOT EXISTS(SELECT VinculoId FROM dbo.CursoCertificado WHERE CanceladoEm IS NULL GROUP BY VinculoId HAVING COUNT(*)>1)
          CREATE UNIQUE INDEX UX_CursoCertificado_Ativo ON dbo.CursoCertificado(VinculoId) WHERE CanceladoEm IS NULL;
      `)
    })().catch((error) => {
      setupPromise = null
      throw error
    })
  }
  return setupPromise
}

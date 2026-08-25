import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assinarStatusCanal,
  assinarStatusCanalComRefetch,
  desconectarCanal,
  instalarDetectorConectividade,
  limparErroRuntime,
  marcarErroRuntime,
  marcarLocalErro,
  marcarLocalOk,
  statusSincronizacao,
  useStatusMesa,
} from './statusMesa';

describe('statusMesa', () => {
  beforeEach(() => {
    useStatusMesa.setState({
      local: 'ok',
      canaisConectados: new Set(),
      canaisComErro: new Set(),
      erroRuntime: null,
      online: true,
    });
  });

  it('começa ok/sem-config', () => {
    const s = useStatusMesa.getState();
    expect(s.local).toBe('ok');
    expect(statusSincronizacao(s)).toBe('sem-config');
  });

  it('marcarLocalErro/marcarLocalOk alternam o status local', () => {
    marcarLocalErro();
    expect(useStatusMesa.getState().local).toBe('erro');
    marcarLocalOk();
    expect(useStatusMesa.getState().local).toBe('ok');
  });

  it('canal SUBSCRIBED marca conectado', () => {
    assinarStatusCanal('tokens-sync')('SUBSCRIBED');
    expect(statusSincronizacao(useStatusMesa.getState())).toBe('conectado');
  });

  it('qualquer canal com erro faz o status geral virar erro, mesmo com outro conectado', () => {
    assinarStatusCanal('tokens-sync')('SUBSCRIBED');
    assinarStatusCanal('fichas-sync')('CHANNEL_ERROR');
    expect(statusSincronizacao(useStatusMesa.getState())).toBe('erro');
  });

  it('canal que erra e depois reconecta limpa o erro', () => {
    const cb = assinarStatusCanal('tokens-sync');
    cb('CHANNEL_ERROR');
    expect(statusSincronizacao(useStatusMesa.getState())).toBe('erro');
    cb('SUBSCRIBED');
    expect(statusSincronizacao(useStatusMesa.getState())).toBe('conectado');
  });

  it('TIMED_OUT e CLOSED também contam como erro', () => {
    assinarStatusCanal('a')('TIMED_OUT');
    expect(statusSincronizacao(useStatusMesa.getState())).toBe('erro');
    useStatusMesa.setState({ canaisConectados: new Set(), canaisComErro: new Set() });
    assinarStatusCanal('b')('CLOSED');
    expect(statusSincronizacao(useStatusMesa.getState())).toBe('erro');
  });

  it('desconectarCanal remove o canal sem acender erro (desmontagem intencional)', () => {
    assinarStatusCanal('tokens-sync')('SUBSCRIBED');
    desconectarCanal('tokens-sync');
    expect(statusSincronizacao(useStatusMesa.getState())).toBe('sem-config');
  });

  it('desconectarCanal também limpa um canal que estava com erro', () => {
    assinarStatusCanal('tokens-sync')('CHANNEL_ERROR');
    desconectarCanal('tokens-sync');
    expect(statusSincronizacao(useStatusMesa.getState())).toBe('sem-config');
  });

  it('marcarErroRuntime/limparErroRuntime controlam o aviso de erro fora do render', () => {
    expect(useStatusMesa.getState().erroRuntime).toBeNull();
    marcarErroRuntime('Cannot read properties of undefined');
    expect(useStatusMesa.getState().erroRuntime).toBe('Cannot read properties of undefined');
    limparErroRuntime();
    expect(useStatusMesa.getState().erroRuntime).toBeNull();
  });

  describe('assinarStatusCanalComRefetch', () => {
    it('primeiro SUBSCRIBED não dispara refetch (já coberto pela busca inicial)', () => {
      const refetch = vi.fn();
      assinarStatusCanalComRefetch('tokens-sync', refetch)('SUBSCRIBED');
      expect(refetch).not.toHaveBeenCalled();
    });

    it('erro seguido de SUBSCRIBED dispara refetch exatamente uma vez', () => {
      const refetch = vi.fn();
      const cb = assinarStatusCanalComRefetch('tokens-sync', refetch);
      cb('CHANNEL_ERROR');
      cb('SUBSCRIBED');
      expect(refetch).toHaveBeenCalledTimes(1);
    });

    it('TIMED_OUT e CLOSED também contam como erro pro refetch', () => {
      const refetchA = vi.fn();
      const cbA = assinarStatusCanalComRefetch('a', refetchA);
      cbA('TIMED_OUT');
      cbA('SUBSCRIBED');
      expect(refetchA).toHaveBeenCalledTimes(1);

      const refetchB = vi.fn();
      const cbB = assinarStatusCanalComRefetch('b', refetchB);
      cbB('CLOSED');
      cbB('SUBSCRIBED');
      expect(refetchB).toHaveBeenCalledTimes(1);
    });

    it('SUBSCRIBED repetido sem erro no meio não redispara', () => {
      const refetch = vi.fn();
      const cb = assinarStatusCanalComRefetch('tokens-sync', refetch);
      cb('CHANNEL_ERROR');
      cb('SUBSCRIBED');
      cb('SUBSCRIBED');
      expect(refetch).toHaveBeenCalledTimes(1);
    });

    it('dois ciclos erro→conectado disparam refetch duas vezes', () => {
      const refetch = vi.fn();
      const cb = assinarStatusCanalComRefetch('tokens-sync', refetch);
      cb('CHANNEL_ERROR');
      cb('SUBSCRIBED');
      cb('CHANNEL_ERROR');
      cb('SUBSCRIBED');
      expect(refetch).toHaveBeenCalledTimes(2);
    });

    it('continua atualizando canaisConectados/canaisComErro como assinarStatusCanal puro', () => {
      const cb = assinarStatusCanalComRefetch('tokens-sync', () => {});
      cb('CHANNEL_ERROR');
      expect(statusSincronizacao(useStatusMesa.getState())).toBe('erro');
      cb('SUBSCRIBED');
      expect(statusSincronizacao(useStatusMesa.getState())).toBe('conectado');
    });
  });

  describe('instalarDetectorConectividade', () => {
    it('não lança mesmo sem `window` de verdade (ambiente de teste)', () => {
      expect(() => instalarDetectorConectividade()).not.toThrow();
    });

    it('começa online por padrão', () => {
      expect(useStatusMesa.getState().online).toBe(true);
    });
  });
});

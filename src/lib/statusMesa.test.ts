import { beforeEach, describe, expect, it } from 'vitest';
import { assinarStatusCanal, desconectarCanal, marcarLocalErro, marcarLocalOk, statusSincronizacao, useStatusMesa } from './statusMesa';

describe('statusMesa', () => {
  beforeEach(() => {
    useStatusMesa.setState({ local: 'ok', canaisConectados: new Set(), canaisComErro: new Set() });
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
});

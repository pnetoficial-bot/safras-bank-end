import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  StatusBar,
  Modal,
  BackHandler,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';

// Safras Bank — ambiente demonstrativo local. Não conecta a serviços bancários reais.
const C = {
  bg: '#090A0B',
  surface: '#141619',
  surface2: '#1B1E21',
  surface3: '#222529',
  line: '#2B2F33',
  gold: '#C5A15A',
  gold2: '#E4C783',
  goldSoft: '#80683B',
  text: '#F2F0EA',
  muted: '#A09B90',
  faint: '#6E6B64',
  green: '#70B98A',
  red: '#D97872',
  blue: '#82A9C9',
};

const KEY = 'safras_bank_v3';
const ICONS = { '◇': 'repeat', '▥': 'file-text', '＋': 'plus-circle', '▯': 'smartphone', '◎': 'target', '◷': 'clock', '◉': 'user-check', '↓': 'arrow-down-left', '↑': 'arrow-up-right', '⚙': 'settings', 'ⓘ': 'info', '▤': 'list' };
const DEV_PASS = '1959';
const INIT = {
  name: 'Ricardo',
  balance: 5000,
  limit: 10000,
  interest: 10,
  interestType: 'simples',
  maxInst: 12,
  loan: 0,
  saved: 0,
  face: false,
  faceStatus: 'none',
  txs: [],
};

const fmt = (n) => (n < 0 ? '-' : '') + 'R$ ' + Math.abs(Number(n) || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const num = (s) => {
  const v = parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(v) ? v : 0;
};
const now = () => {
  const d = new Date();
  return d.toLocaleDateString('pt-BR') + ' • ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};
const loanTotal = (v, n, i, type) => (type === 'composto' ? v * Math.pow(1 + i / 100, n) : v * (1 + (i / 100) * n));
const initials = (name) => String(name || 'S').trim().split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('').toUpperCase();

const KINDS = [
  ['cpf', 'CPF', '000.000.000-00'],
  ['cnpj', 'CNPJ', '00.000.000/0000-00'],
  ['phone', 'Celular', '(00) 00000-0000'],
  ['email', 'E-mail', 'nome@email.com'],
  ['rand', 'Aleatória', 'Chave aleatória'],
];

const mask = (k, v) => {
  const n = String(v).replace(/\D/g, '');
  if (k === 'cpf') return n.slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  if (k === 'cnpj') return n.slice(0, 14).replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
  if (k === 'phone') return n.slice(0, 11).replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2');
  return v;
};

const validCPF = (value) => {
  const n = String(value).replace(/\D/g, '');
  if (n.length !== 11 || /^(\d)\1+$/.test(n)) return false;
  const digit = (base, weight) => {
    const sum = base.split('').reduce((acc, item, i) => acc + Number(item) * (weight - i), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(n.slice(0, 9), 10) === Number(n[9]) && digit(n.slice(0, 10), 11) === Number(n[10]);
};

const validCNPJ = (value) => {
  const n = String(value).replace(/\D/g, '');
  if (n.length !== 14 || /^(\d)\1+$/.test(n)) return false;
  const calc = (base, weights) => {
    const sum = base.split('').reduce((acc, item, i) => acc + Number(item) * weights[i], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const first = calc(n.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calc(n.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(n[12]) && second === Number(n[13]);
};

const validKey = (k, v) => {
  const n = String(v).replace(/\D/g, '');
  if (k === 'cpf') return validCPF(n);
  if (k === 'cnpj') return validCNPJ(n);
  if (k === 'phone') return n.length === 10 || n.length === 11;
  if (k === 'email') return /^\S+@\S+\.\S+$/.test(String(v).trim());
  return String(v).trim().length >= 8;
};

function Logo({ size = 40 }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: Math.max(1.5, size / 18), borderColor: C.gold, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101113' }}>
      <Text style={{ color: C.gold2, fontSize: size * 0.57, fontWeight: '800', fontFamily: 'serif', lineHeight: size * 0.68 }}>S</Text>
    </View>
  );
}

function IconBox({ icon, size = 46, active = false, tint }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 15, backgroundColor: active ? 'rgba(197,161,90,0.16)' : C.surface3, borderWidth: 1, borderColor: active ? 'rgba(197,161,90,0.36)' : C.line, alignItems: 'center', justifyContent: 'center' }}>
      <Feather name={ICONS[icon] || icon || 'circle'} size={size * 0.43} color={tint || (active ? C.gold2 : C.gold)} strokeWidth={1.8} />
    </View>
  );
}

function Pill({ children, tone = 'gold' }) {
  const color = tone === 'green' ? C.green : tone === 'red' ? C.red : C.gold2;
  return (
    <View style={{ alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: tone === 'green' ? 'rgba(112,185,138,0.10)' : tone === 'red' ? 'rgba(217,120,114,0.10)' : 'rgba(197,161,90,0.10)', borderWidth: 1, borderColor: tone === 'green' ? 'rgba(112,185,138,0.25)' : tone === 'red' ? 'rgba(217,120,114,0.25)' : 'rgba(197,161,90,0.25)' }}>
      <Text style={{ color, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>{children}</Text>
    </View>
  );
}

function Lock({ name, onOk }) {
  const p = useRef(new Animated.Value(0)).current;
  const anim = useRef(null);
  const start = () => {
    anim.current = Animated.timing(p, { toValue: 1, duration: 900, useNativeDriver: true });
    anim.current.start(({ finished }) => { if (finished) onOk(); });
  };
  const stop = () => {
    if (anim.current) anim.current.stop();
    Animated.timing(p, { toValue: 0, duration: 180, useNativeDriver: true }).start();
  };
  return (
    <View style={s.lockRoot}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <View style={s.lockBrand}>
        <Logo size={76} />
        <Text style={s.lockBrandName}>Safras Bank</Text>
        <Text style={s.lockBrandCaption}>Sua vida financeira, em um só lugar.</Text>
      </View>
      <View style={s.lockAccess}>
        <Text style={s.lockTitle}>Bem-vindo de volta</Text>
        <Text style={s.lockName}>{name}</Text>
        <TouchableOpacity activeOpacity={1} onPressIn={start} onPressOut={stop} style={s.fpWrap}>
          <View style={s.fpInner}><Feather name="shield" size={54} color={C.gold2} strokeWidth={1.5} /></View>
          <Animated.View style={[s.fpProgress, { opacity: p, transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.08] }) }] }]} />
        </TouchableOpacity>
        <Text style={s.lockHint}>Mantenha pressionado para acessar</Text>
        <Text style={s.lockFoot}>Acesso local de demonstração</Text>
      </View>
    </View>
  );
}

function Btn({ label, onPress, ghost, danger, disabled, style }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.82} style={[s.btn, ghost && s.btnGhost, danger && s.btnDanger, disabled && { opacity: 0.45 }, style]}>
      <Text style={[s.btnTxt, ghost && { color: C.gold2 }, danger && { color: C.red }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Field({ label, value, onChangeText, numeric, secure, placeholder, keyboard, multiline, autoCapitalize, maxLength, hint }) {
  return (
    <View style={s.fieldWrap}>
      {!!label && <Text style={s.label}>{label}</Text>}
      <TextInput
        style={[s.input, multiline && { minHeight: 90, textAlignVertical: 'top', paddingTop: 13 }]}
        value={String(value ?? '')}
        onChangeText={onChangeText}
        keyboardType={keyboard || (numeric ? 'decimal-pad' : 'default')}
        secureTextEntry={secure}
        placeholder={placeholder}
        placeholderTextColor={C.faint}
        autoCapitalize={autoCapitalize || 'none'}
        maxLength={maxLength}
        multiline={multiline}
      />
      {!!hint && <Text style={s.fieldHint}>{hint}</Text>}
    </View>
  );
}

function Chips({ opts, value, onChange }) {
  return (
    <View style={s.chipsWrap}>
      {opts.map(([k, label]) => {
        const selected = value === k;
        return (
          <TouchableOpacity key={String(k)} onPress={() => onChange(k)} activeOpacity={0.8} style={[s.chip, selected && s.chipOn]}>
            <Text style={[s.chipText, selected && s.chipTextOn]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function SectionTitle({ title, action, onAction, style }) {
  return (
    <View style={[s.sectionHead, style]}>
      <Text style={s.sectionTitle}>{title}</Text>
      {!!action && <TouchableOpacity onPress={onAction}><Text style={s.sectionAction}>{action}</Text></TouchableOpacity>}
    </View>
  );
}

function Gate({ d, go, children }) {
  if (!d.face || d.faceStatus === 'approved') return children;
  if (d.faceStatus === 'sent') {
    return (
      <View style={s.gateCard}>
        <IconBox icon="◷" size={58} active />
        <Text style={s.gateTitle}>Validação em análise</Text>
        <Text style={s.gateText}>A solicitação foi registrada neste ambiente de demonstração. Os serviços protegidos ficarão bloqueados até a aprovação manual nas ferramentas de teste.</Text>
        <Pill>AGUARDANDO APROVAÇÃO</Pill>
      </View>
    );
  }
  return (
    <View style={s.gateCard}>
      <IconBox icon="◉" size={58} active />
      <Text style={s.gateTitle}>Confirme sua identidade</Text>
      <Text style={s.gateText}>A verificação é necessária para continuar. Nesta versão, o fluxo é apenas demonstrativo e não envia imagens para um banco.</Text>
      <Btn label="Iniciar verificação" onPress={() => go('face')} style={{ alignSelf: 'stretch', marginTop: 6 }} />
    </View>
  );
}

export default function App() {
  const [d, setD] = useState(INIT);
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [stack, setStack] = useState(['home']);
  const [pwModal, setPwModal] = useState(false);
  const [pw, setPw] = useState('');
  const [hideBalance, setHideBalance] = useState(false);
  const scr = stack[stack.length - 1];
  const mainTabs = ['home', 'extrato', 'servicos', 'perfil'];
  const isMain = mainTabs.includes(scr) && stack.length === 1;
  const go = (k) => setStack((st) => [...st, k]);
  const selectTab = (k) => setStack([k]);
  const back = () => setStack((st) => (st.length > 1 ? st.slice(0, -1) : st));

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v) {
          const saved = JSON.parse(v);
          setD({ ...INIT, ...saved, txs: Array.isArray(saved.txs) ? saved.txs : [] });
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(KEY, JSON.stringify(d)).catch(() => {});
  }, [d, ready]);

  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pwModal) { setPwModal(false); setPw(''); return true; }
      if (stack.length > 1) { back(); return true; }
      if (scr !== 'home') { selectTab('home'); return true; }
      return false;
    });
    return () => h.remove();
  }, [stack, pwModal, scr]);

  const addTx = (nd, title, value, detail = '') => ({
    ...nd,
    txs: [{ id: String(Date.now()) + String(Math.random()).slice(2, 7), title, value, detail, date: now() }, ...(nd.txs || [])].slice(0, 100),
  });

  const move = (title, value, extra = {}, detail = '') => {
    setD((p) => addTx({ ...p, ...extra, balance: p.balance + value }, title, value, detail));
  };

  const openDev = () => {
    if (pw === DEV_PASS) { setPwModal(false); setPw(''); go('dev'); }
    else { Alert.alert('Senha incorreta', 'Confira a senha e tente novamente.'); setPw(''); }
  };

  if (!ready) return <View style={[s.root, s.loading]}><Logo size={70} /><Text style={s.loadingText}>Safras Bank</Text></View>;
  if (!unlocked) return <Lock name={d.name} onOk={() => setUnlocked(true)} />;

  const titleMap = { pix: 'PIX', boleto: 'Pagar boleto', loan: 'Empréstimo', recarga: 'Recarga de celular', cofre: 'Cofrinho', face: 'Verificação de identidade', dev: 'Ferramentas de teste' };
  const G = (el) => <Gate d={d} go={go}>{el}</Gate>;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <View style={s.header}>
        {isMain ? (
          <>
            <View style={s.headerBrand}>
              <Logo size={35} />
              <View>
                <Text style={s.brand}>Safras Bank</Text>
                <Text style={s.brandCaption}>AMBIENTE DE DEMONSTRAÇÃO</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => selectTab('perfil')} style={s.avatar}>
              <Text style={s.avatarText}>{initials(d.name)}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity onPress={back} style={s.backButton}>
              <Text style={s.backGlyph}>‹</Text>
              <Text style={s.backText}>Voltar</Text>
            </TouchableOpacity>
            <Text style={s.headerTitle}>{titleMap[scr] || 'Safras Bank'}</Text>
            <View style={{ width: 70 }} />
          </>
        )}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.pageContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {scr === 'home' && <Home d={d} go={go} openTab={selectTab} hideBalance={hideBalance} setHideBalance={setHideBalance} />}
          {scr === 'extrato' && <Extrato d={d} />}
          {scr === 'servicos' && <Services go={go} />}
          {scr === 'perfil' && <Profile d={d} openDev={() => setPwModal(true)} setUnlocked={setUnlocked} />}
          {scr === 'pix' && G(<Pix d={d} move={move} back={back} />)}
          {scr === 'boleto' && G(<Boleto d={d} move={move} back={back} />)}
          {scr === 'loan' && G(<Loan d={d} move={move} back={back} />)}
          {scr === 'recarga' && G(<Recarga d={d} move={move} back={back} />)}
          {scr === 'cofre' && G(<Cofre d={d} setD={setD} addTx={addTx} />)}
          {scr === 'face' && <Face setD={setD} back={back} />}
          {scr === 'dev' && <Dev d={d} setD={setD} addTx={addTx} back={back} />}
        </ScrollView>
      </KeyboardAvoidingView>

      {isMain && <BottomNav current={scr} onSelect={selectTab} />}

      <Modal transparent visible={pwModal} animationType="fade" onRequestClose={() => { setPwModal(false); setPw(''); }}>
        <View style={s.modalBg}>
          <View style={s.modal}>
            <View style={s.modalIcon}><Logo size={42} /></View>
            <Text style={s.modalTitle}>Acesso às ferramentas</Text>
            <Text style={s.modalText}>Área reservada para ajustes da demonstração.</Text>
            <Field label="Senha de acesso" value={pw} onChangeText={setPw} secure keyboard="number-pad" placeholder="Digite a senha" />
            <Btn label="Continuar" onPress={openDev} />
            <Btn label="Cancelar" ghost style={{ marginTop: 10 }} onPress={() => { setPwModal(false); setPw(''); }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function BottomNav({ current, onSelect }) {
  const items = [
    ['home', 'home', 'Início'],
    ['extrato', 'file-text', 'Extrato'],
    ['servicos', 'grid', 'Serviços'],
    ['perfil', 'user', 'Perfil'],
  ];
  return (
    <View style={s.bottomNav}>
      {items.map(([key, icon, label]) => {
        const active = current === key;
        return (
          <TouchableOpacity key={key} onPress={() => onSelect(key)} style={s.navItem} activeOpacity={0.8}>
            <Feather name={icon} size={20} color={active ? C.gold2 : C.faint} strokeWidth={active ? 2.2 : 1.7} />
            <Text style={[s.navLabel, active && s.navLabelActive]}>{label}</Text>
            {active && <View style={s.navIndicator} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Home({ d, go, openTab, hideBalance, setHideBalance }) {
  const quick = [
    ['pix', '◇', 'PIX'],
    ['boleto', '▥', 'Pagar boleto'],
    ['loan', '＋', 'Empréstimo'],
    ['recarga', '▯', 'Recarga'],
  ];
  return (
    <>
      <View style={s.greetingRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.greeting}>Olá, {String(d.name).split(' ')[0]}.</Text>
          <Text style={s.greetingSub}>Aqui está o resumo da sua conta.</Text>
        </View>
        <Pill>CONTA TESTE</Pill>
      </View>

      <View style={s.balanceCard}>
        <View style={s.balanceCardTop}>
          <View>
            <Text style={s.balanceLabel}>SALDO EM CONTA</Text>
            <Text style={s.accountType}>Conta corrente</Text>
          </View>
          <TouchableOpacity onPress={() => setHideBalance(!hideBalance)} style={s.eyeButton}>
            <Feather name={hideBalance ? 'eye-off' : 'eye'} size={18} color={C.gold2} />
          </TouchableOpacity>
        </View>
        <Text style={s.balanceAmount} numberOfLines={1} adjustsFontSizeToFit>{hideBalance ? 'R$ ••••••' : fmt(d.balance)}</Text>
        <View style={s.cardDivider} />
        <View style={s.balanceMetaRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.metaLabel}>Limite disponível</Text>
            <Text style={s.metaValue}>{hideBalance ? '••••••' : fmt(Math.max(0, d.limit - d.loan))}</Text>
          </View>
          <View style={s.metaDivider} />
          <View style={{ flex: 1 }}>
            <Text style={s.metaLabel}>Empréstimo em aberto</Text>
            <Text style={[s.metaValue, d.loan > 0 && { color: C.red }]}>{hideBalance ? '••••••' : fmt(d.loan)}</Text>
          </View>
        </View>
        <View style={s.cardAccent} />
      </View>

      <SectionTitle title="Acesso rápido" style={{ marginTop: 27 }} />
      <View style={s.quickGrid}>
        {quick.map(([key, icon, label]) => (
          <TouchableOpacity key={key} onPress={() => go(key)} style={s.quickItem} activeOpacity={0.8}>
            <IconBox icon={icon} size={49} active />
            <Text style={s.quickLabel}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity onPress={() => go('cofre')} style={s.savingsBanner} activeOpacity={0.85}>
        <IconBox icon="◎" size={48} active />
        <View style={{ flex: 1, marginLeft: 13 }}>
          <Text style={s.savingsTitle}>Cofrinho Safras</Text>
          <Text style={s.savingsText}>Guarde uma parte do seu saldo e acompanhe sua reserva.</Text>
        </View>
        <Text style={s.chevron}>›</Text>
      </TouchableOpacity>

      <SectionTitle title="Últimas movimentações" action="Ver extrato" onAction={() => openTab('extrato')} style={{ marginTop: 28 }} />
      <TxList txs={(d.txs || []).slice(0, 4)} compact />
    </>
  );
}

function Services({ go }) {
  const list = [
    ['pix', '◇', 'PIX', 'Envie ou receba valores'],
    ['boleto', '▥', 'Pagar boleto', 'Escaneie ou digite o código'],
    ['loan', '＋', 'Empréstimo', 'Simule e acompanhe parcelas'],
    ['recarga', '▯', 'Recarga de celular', 'Escolha a operadora e o valor'],
    ['cofre', '◎', 'Cofrinho', 'Separe dinheiro para seus planos'],
  ];
  return (
    <>
      <Text style={s.pageTitle}>Serviços</Text>
      <Text style={s.pageSubtitle}>O que você precisa fazer hoje?</Text>
      <View style={{ marginTop: 15 }}>
        {list.map(([key, icon, title, desc]) => (
          <TouchableOpacity key={key} onPress={() => go(key)} style={s.serviceRow} activeOpacity={0.8}>
            <IconBox icon={icon} size={48} active />
            <View style={{ flex: 1, marginLeft: 13 }}>
              <Text style={s.serviceTitle}>{title}</Text>
              <Text style={s.serviceDesc}>{desc}</Text>
            </View>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={s.noticeCard}>
        <Text style={s.noticeSymbol}>i</Text>
        <Text style={s.noticeText}>Este aplicativo é uma demonstração local. As operações não são enviadas ou processadas por uma instituição financeira.</Text>
      </View>
    </>
  );
}

function Profile({ d, openDev, setUnlocked }) {
  return (
    <>
      <Text style={s.pageTitle}>Perfil</Text>
      <View style={s.profileCard}>
        <View style={s.profileAvatar}><Text style={s.profileAvatarText}>{initials(d.name)}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.profileName}>{d.name}</Text>
          <Text style={s.profileCaption}>Titular da conta demonstrativa</Text>
          <Pill tone="green">ATIVA</Pill>
        </View>
      </View>
      <SectionTitle title="Dados da conta" style={{ marginTop: 25 }} />
      <View style={s.detailCard}>
        <DetailRow label="Instituição" value="Safras Bank" />
        <DetailRow label="Agência" value="0001" />
        <DetailRow label="Conta" value="000123-4" last />
      </View>
      <SectionTitle title="Preferências" style={{ marginTop: 25 }} />
      <TouchableOpacity style={s.serviceRow} onPress={openDev} activeOpacity={0.8}>
        <IconBox icon="⚙" size={46} />
        <View style={{ flex: 1, marginLeft: 13 }}>
          <Text style={s.serviceTitle}>Ferramentas de teste</Text>
          <Text style={s.serviceDesc}>Ajustes de saldo, limites e simulação</Text>
        </View>
        <Text style={s.chevron}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.serviceRow} onPress={() => Alert.alert('Sobre o Safras Bank', 'Aplicativo demonstrativo desenvolvido para simular uma experiência de banco digital. Não representa uma instituição financeira real.')} activeOpacity={0.8}>
        <IconBox icon="ⓘ" size={46} />
        <View style={{ flex: 1, marginLeft: 13 }}>
          <Text style={s.serviceTitle}>Sobre o aplicativo</Text>
          <Text style={s.serviceDesc}>Versão e informações do projeto</Text>
        </View>
        <Text style={s.chevron}>›</Text>
      </TouchableOpacity>
      <Btn label="Sair da conta" ghost style={{ marginTop: 24 }} onPress={() => setUnlocked(false)} />
      <Text style={s.profileFoot}>Safras Bank • Ambiente de demonstração</Text>
    </>
  );
}

function DetailRow({ label, value, last }) {
  return (
    <View style={[s.detailRow, !last && { borderBottomWidth: 1, borderBottomColor: C.line }]}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailValue}>{value}</Text>
    </View>
  );
}

function TxList({ txs, compact = false }) {
  if (!txs || !txs.length) {
    return (
      <View style={s.emptyState}>
        <IconBox icon="▤" size={48} />
        <Text style={s.emptyTitle}>Nenhuma movimentação</Text>
        <Text style={s.emptyText}>Quando você fizer uma operação, ela aparecerá aqui.</Text>
      </View>
    );
  }
  return txs.map((t) => {
    const incoming = Number(t.value) > 0;
    const icon = /PIX/i.test(t.title) ? '◇' : /boleto/i.test(t.title) ? '▥' : /cofrinho/i.test(t.title) ? '◎' : /empréstimo/i.test(t.title) ? '＋' : /recarga/i.test(t.title) ? '▯' : incoming ? '↓' : '↑';
    return (
      <View key={t.id} style={[s.txRow, compact && s.txRowCompact]}>
        <IconBox icon={icon} size={compact ? 40 : 44} />
        <View style={{ flex: 1, marginLeft: 12, paddingRight: 8 }}>
          <Text style={s.txTitle} numberOfLines={1}>{t.title}</Text>
          <Text style={s.txDate}>{t.date}</Text>
          {!!t.detail && !compact && <Text style={s.txDetail}>{t.detail}</Text>}
        </View>
        <Text style={[s.txValue, { color: incoming ? C.green : C.text }]}>{incoming ? '+ ' : '− '}{fmt(Math.abs(Number(t.value) || 0))}</Text>
      </View>
    );
  });
}

function Extrato({ d }) {
  const [filter, setFilter] = useState('all');
  const txs = (d.txs || []).filter((t) => filter === 'all' || (filter === 'in' ? t.value > 0 : t.value < 0));
  return (
    <>
      <Text style={s.pageTitle}>Extrato</Text>
      <Text style={s.pageSubtitle}>Acompanhe as movimentações da sua conta.</Text>
      <View style={s.filterBar}>
        <Chips opts={[['all', 'Todas'], ['in', 'Entradas'], ['out', 'Saídas']]} value={filter} onChange={setFilter} />
      </View>
      {txs.length ? <TxList txs={txs} /> : (
        <View style={s.emptyState}>
          <IconBox icon="▤" size={52} />
          <Text style={s.emptyTitle}>{filter === 'all' ? 'Seu extrato está vazio' : 'Nenhuma movimentação encontrada'}</Text>
          <Text style={s.emptyText}>As operações registradas aparecerão nesta lista.</Text>
        </View>
      )}
    </>
  );
}

function Pix({ d, move, back }) {
  const [mode, setMode] = useState('send');
  const [kind, setKind] = useState('cpf');
  const [key, setKey] = useState('');
  const [who, setWho] = useState('');
  const [val, setVal] = useState('');
  const [msg, setMsg] = useState('');
  const k = KINDS.find((x) => x[0] === kind) || KINDS[0];
  const run = () => {
    const v = num(val);
    const label = who.trim() || key;
    if (!validKey(kind, key)) return Alert.alert('Chave inválida', 'Confira a chave informada e tente novamente.');
    if (v <= 0) return Alert.alert('Valor inválido', 'Digite um valor maior que zero.');
    if (mode === 'send' && v > d.balance) return Alert.alert('Saldo insuficiente', 'O saldo disponível é ' + fmt(d.balance) + '.');
    Alert.alert(mode === 'send' ? 'Revisar transferência' : 'Confirmar recebimento', (mode === 'send' ? 'Você está enviando ' : 'Você está registrando o recebimento de ') + fmt(v) + (mode === 'send' ? ' para ' : ' de ') + label + '.\n\nChave: ' + key + (msg.trim() ? '\nMensagem: ' + msg.trim() : '') + '\n\nOperação simulada, sem envio bancário.', [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Confirmar', onPress: () => {
        const title = mode === 'send' ? 'PIX enviado para ' + label : 'PIX recebido de ' + label;
        move(title, mode === 'send' ? -v : v, {}, msg.trim());
        Alert.alert(mode === 'send' ? 'PIX registrado' : 'Recebimento registrado', fmt(v) + '\n\nOperação adicionada ao extrato local.', [{ text: 'Concluir', onPress: back }]);
      } },
    ]);
  };
  return (
    <>
      <Text style={s.pageTitle}>PIX</Text>
      <Text style={s.pageSubtitle}>Transfira ou registre um recebimento.</Text>
      <View style={s.tabs}>
        <TouchableOpacity style={[s.tab, mode === 'send' && s.tabOn]} onPress={() => setMode('send')}><Text style={[s.tabTxt, mode === 'send' && s.tabTxtOn]}>Enviar</Text></TouchableOpacity>
        <TouchableOpacity style={[s.tab, mode === 'recv' && s.tabOn]} onPress={() => setMode('recv')}><Text style={[s.tabTxt, mode === 'recv' && s.tabTxtOn]}>Receber</Text></TouchableOpacity>
      </View>
      <Text style={s.formSection}>Dados da chave</Text>
      <Text style={s.label}>Tipo de chave</Text>
      <Chips opts={KINDS.map((x) => [x[0], x[1]])} value={kind} onChange={(x) => { setKind(x); setKey(''); }} />
      <Field label={mode === 'send' ? 'Chave do destinatário' : 'Chave de quem enviou'} value={key} onChangeText={(v) => setKey(mask(kind, v))} placeholder={k[2]} keyboard={kind === 'email' ? 'email-address' : kind === 'rand' ? 'default' : 'number-pad'} autoCapitalize={kind === 'email' ? 'none' : 'sentences'} />
      <Field label="Nome (opcional)" value={who} onChangeText={setWho} placeholder="Nome da pessoa" autoCapitalize="words" />
      <Text style={[s.formSection, { marginTop: 8 }]}>Detalhes da operação</Text>
      <Field label="Valor (R$)" value={val} onChangeText={setVal} numeric placeholder="0,00" />
      <Field label="Mensagem (opcional)" value={msg} onChangeText={setMsg} placeholder="Adicione uma descrição" maxLength={80} />
      <View style={s.formFootnote}><Text style={s.formFootnoteText}>A transferência será apenas registrada nesta demonstração.</Text></View>
      <Btn label={mode === 'send' ? 'Revisar PIX' : 'Registrar recebimento'} onPress={run} />
    </>
  );
}

function Boleto({ d, move, back }) {
  const [mode, setMode] = useState('scan');
  const [perm, req] = useCameraPermissions();
  const [code, setCode] = useState('');
  const [val, setVal] = useState('');
  const got = useRef(false);
  const apply = (data) => {
    const n = String(data).replace(/\D/g, '');
    setCode(n);
    // O valor só é inferido quando o código de barras tem o campo de valor conhecido.
    if (n.length === 44) {
      const raw = parseInt(n.slice(9, 19), 10);
      if (Number.isFinite(raw) && raw > 0) setVal((raw / 100).toFixed(2).replace('.', ','));
    }
  };
  const onScan = ({ data }) => {
    if (got.current) return;
    got.current = true;
    apply(data);
    setMode('type');
  };
  const pay = () => {
    const v = num(val);
    if (![44, 47, 48].includes(code.replace(/\D/g, '').length)) return Alert.alert('Código inválido', 'Informe um código de barras com 44 dígitos ou uma linha digitável com 47 ou 48 dígitos.');
    if (v <= 0) return Alert.alert('Valor inválido', 'Informe o valor do boleto.');
    if (v > d.balance) return Alert.alert('Saldo insuficiente', 'O saldo disponível é ' + fmt(d.balance) + '.');
    Alert.alert('Confirmar pagamento', 'Valor: ' + fmt(v) + '\nCódigo: ' + code.slice(0, 5) + '••••' + code.slice(-4) + '\n\nPagamento simulado, sem liquidação bancária.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', onPress: () => {
        move('Boleto pago', -v, {}, 'Código final ' + code.slice(-4));
        Alert.alert('Pagamento registrado', fmt(v) + '\n\nA movimentação foi adicionada ao extrato local.', [{ text: 'Concluir', onPress: back }]);
      } },
    ]);
  };
  return (
    <>
      <Text style={s.pageTitle}>Pagar boleto</Text>
      <Text style={s.pageSubtitle}>Use a câmera ou informe a linha digitável.</Text>
      <View style={s.tabs}>
        <TouchableOpacity style={[s.tab, mode === 'scan' && s.tabOn]} onPress={() => { got.current = false; setMode('scan'); }}><Text style={[s.tabTxt, mode === 'scan' && s.tabTxtOn]}>Escanear código</Text></TouchableOpacity>
        <TouchableOpacity style={[s.tab, mode === 'type' && s.tabOn]} onPress={() => setMode('type')}><Text style={[s.tabTxt, mode === 'type' && s.tabTxtOn]}>Digitar código</Text></TouchableOpacity>
      </View>
      {mode === 'scan' ? (
        !perm ? <View style={s.cameraPlaceholder}><Text style={s.cameraHint}>Preparando câmera…</Text></View> : !perm.granted ? (
          <View style={s.gateCard}>
            <IconBox icon="▥" size={54} active />
            <Text style={s.gateTitle}>Permissão para câmera</Text>
            <Text style={s.gateText}>Autorize o acesso à câmera para demonstrar a leitura do código de barras.</Text>
            <Btn label="Permitir câmera" onPress={req} style={{ alignSelf: 'stretch' }} />
          </View>
        ) : (
          <View style={s.camBox}>
            <CameraView style={{ flex: 1 }} facing="back" onBarcodeScanned={onScan} barcodeScannerSettings={{ barcodeTypes: ['code128', 'code39', 'ean13', 'ean8', 'itf14', 'upc_a', 'upc_e', 'pdf417', 'qr'] }} />
            <View style={s.scanFrame}><View style={s.scanLine} /></View>
            <View style={s.camHintWrap}><Text style={s.camHint}>Centralize o código de barras na moldura</Text></View>
          </View>
        )
      ) : (
        <>
          <Field label="Código de barras / linha digitável" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 48))} keyboard="number-pad" placeholder="Digite os números do boleto" maxLength={48} />
          <Field label="Valor do boleto (R$)" value={val} onChangeText={setVal} numeric placeholder="0,00" />
          <View style={s.formFootnote}><Text style={s.formFootnoteText}>Confira o código e o valor antes de registrar o pagamento.</Text></View>
          <Btn label="Revisar pagamento" onPress={pay} />
        </>
      )}
    </>
  );
}

function Loan({ d, move, back }) {
  const [val, setVal] = useState('');
  const opts = [1, 2, 3, 4, 6, 8, 10, 12, 18, 24, 36].filter((x) => x <= Math.max(1, d.maxInst));
  const [n, setN] = useState(1);
  useEffect(() => { if (!opts.includes(n)) setN(opts[opts.length - 1] || 1); }, [d.maxInst]);
  const avail = Math.max(0, d.limit - d.loan);
  const v = num(val);
  const total = loanTotal(v, n, d.interest, d.interestType);
  const ask = () => {
    if (v <= 0) return Alert.alert('Valor inválido', 'Digite quanto deseja simular.');
    if (v > avail) return Alert.alert('Limite insuficiente', 'O limite demonstrativo disponível é ' + fmt(avail) + '.');
    Alert.alert('Confirmar simulação', 'Valor solicitado: ' + fmt(v) + '\nPrazo: ' + n + 'x\nTotal estimado: ' + fmt(total) + '\nParcela estimada: ' + fmt(total / n) + '\n\nEsta operação não gera crédito real.', [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Confirmar', onPress: () => {
        move('Empréstimo simulado (' + n + 'x)', v, { loan: d.loan + total }, 'Total estimado: ' + fmt(total));
        Alert.alert('Simulação registrada', 'Valor adicionado ao saldo demonstrativo: ' + fmt(v) + '.\nDívida simulada: ' + fmt(total) + '.', [{ text: 'Concluir', onPress: back }]);
      } },
    ]);
  };
  const pay = () => {
    if (d.loan <= 0) return Alert.alert('Sem dívida', 'Não há empréstimo demonstrativo em aberto.');
    if (v <= 0) return Alert.alert('Valor inválido', 'Informe quanto deseja pagar.');
    const p = Math.min(v, d.loan);
    if (p > d.balance) return Alert.alert('Saldo insuficiente', 'O saldo disponível é ' + fmt(d.balance) + '.');
    Alert.alert('Confirmar pagamento', 'Valor a abater: ' + fmt(p), [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', onPress: () => {
        move('Pagamento de empréstimo', -p, { loan: Math.max(0, d.loan - p) }, 'Abatimento de dívida demonstrativa');
        Alert.alert('Pagamento registrado', fmt(p) + ' abatidos da dívida.', [{ text: 'Concluir', onPress: back }]);
      } },
    ]);
  };
  return (
    <>
      <Text style={s.pageTitle}>Empréstimo</Text>
      <Text style={s.pageSubtitle}>Simule valores, prazos e o custo estimado.</Text>
      <View style={s.loanSummary}>
        <View style={s.loanSummaryTop}><Text style={s.balanceLabel}>LIMITE PARA SIMULAÇÃO</Text><Pill>DEMONSTRATIVO</Pill></View>
        <Text style={s.loanAvailable}>{fmt(avail)}</Text>
        <View style={s.cardDivider} />
        <View style={s.balanceMetaRow}>
          <View style={{ flex: 1 }}><Text style={s.metaLabel}>Taxa mensal</Text><Text style={s.metaValue}>{d.interest}%</Text></View>
          <View style={s.metaDivider} />
          <View style={{ flex: 1 }}><Text style={s.metaLabel}>Dívida atual</Text><Text style={[s.metaValue, d.loan > 0 && { color: C.red }]}>{fmt(d.loan)}</Text></View>
        </View>
      </View>
      <Text style={s.formSection}>Nova simulação</Text>
      <Field label="Valor desejado (R$)" value={val} onChangeText={setVal} numeric placeholder="0,00" />
      <Text style={s.label}>Quantidade de parcelas</Text>
      <Chips opts={opts.map((x) => [x, x + 'x'])} value={n} onChange={setN} />
      {v > 0 && (
        <View style={s.installmentCard}>
          <Text style={s.metaLabel}>Estimativa da operação</Text>
          <Text style={s.installmentValue}>{fmt(total / n)} <Text style={s.installmentSuffix}>/ mês</Text></Text>
          <View style={s.cardDivider} />
          <DetailRow label="Valor solicitado" value={fmt(v)} />
          <DetailRow label="Total estimado" value={fmt(total)} />
          <DetailRow label="Juros estimados" value={fmt(total - v)} last />
        </View>
      )}
      <Btn label="Simular empréstimo" onPress={ask} />
      <Btn label="Pagar dívida demonstrativa" ghost style={{ marginTop: 10 }} onPress={pay} />
    </>
  );
}

function Recarga({ d, move, back }) {
  const [op, setOp] = useState('Vivo');
  const [tel, setTel] = useState('');
  const [val, setVal] = useState(20);
  const [custom, setCustom] = useState('');
  const amount = val === 'other' ? num(custom) : Number(val);
  const run = () => {
    if (tel.replace(/\D/g, '').length !== 10 && tel.replace(/\D/g, '').length !== 11) return Alert.alert('Número inválido', 'Informe o DDD e o número do celular.');
    if (amount <= 0) return Alert.alert('Valor inválido', 'Escolha ou informe um valor para a recarga.');
    if (amount > d.balance) return Alert.alert('Saldo insuficiente', 'O saldo disponível é ' + fmt(d.balance) + '.');
    Alert.alert('Confirmar recarga', 'Operadora: ' + op + '\nNúmero: ' + tel + '\nValor: ' + fmt(amount) + '\n\nRecarga simulada, sem comunicação com a operadora.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', onPress: () => {
        move('Recarga ' + op, -amount, {}, tel);
        Alert.alert('Recarga registrada', fmt(amount) + ' para ' + tel + '.', [{ text: 'Concluir', onPress: back }]);
      } },
    ]);
  };
  return (
    <>
      <Text style={s.pageTitle}>Recarga de celular</Text>
      <Text style={s.pageSubtitle}>Escolha a operadora e informe os dados.</Text>
      <Text style={s.formSection}>Operadora</Text>
      <Chips opts={['Vivo', 'Claro', 'TIM', 'Oi'].map((x) => [x, x])} value={op} onChange={setOp} />
      <Field label="Número do celular" value={tel} onChangeText={(v) => setTel(mask('phone', v))} keyboard="phone-pad" placeholder="(00) 00000-0000" maxLength={15} />
      <Text style={s.label}>Valor da recarga</Text>
      <Chips opts={[[15, 'R$ 15'], [20, 'R$ 20'], [30, 'R$ 30'], [50, 'R$ 50'], ['other', 'Outro valor']]} value={val} onChange={setVal} />
      {val === 'other' && <Field label="Outro valor (R$)" value={custom} onChangeText={setCustom} numeric placeholder="0,00" />}
      <View style={s.formFootnote}><Text style={s.formFootnoteText}>A recarga será registrada apenas no saldo e no extrato de demonstração.</Text></View>
      <Btn label="Revisar recarga" onPress={run} />
    </>
  );
}

function Cofre({ d, setD, addTx }) {
  const [val, setVal] = useState('');
  const act = (sign) => {
    const v = num(val);
    if (v <= 0) return Alert.alert('Valor inválido', 'Digite um valor maior que zero.');
    if (sign > 0 && v > d.balance) return Alert.alert('Saldo insuficiente', 'O saldo disponível é ' + fmt(d.balance) + '.');
    if (sign < 0 && v > d.saved) return Alert.alert('Saldo insuficiente', 'O cofrinho tem ' + fmt(d.saved) + ' guardados.');
    const next = addTx({ ...d, balance: d.balance - sign * v, saved: d.saved + sign * v }, sign > 0 ? 'Depósito no cofrinho' : 'Resgate do cofrinho', -sign * v);
    setD(next);
    setVal('');
    Alert.alert(sign > 0 ? 'Valor guardado' : 'Valor resgatado', fmt(v) + (sign > 0 ? ' foram adicionados ao cofrinho.' : ' foram transferidos para o saldo.'));
  };
  return (
    <>
      <Text style={s.pageTitle}>Cofrinho</Text>
      <Text style={s.pageSubtitle}>Uma reserva separada do seu saldo principal.</Text>
      <View style={s.savingsHero}>
        <View style={s.savingsHeroIcon}><Feather name="pocket" size={34} color={C.gold2} strokeWidth={1.6} /></View>
        <Text style={s.savingsHeroLabel}>TOTAL GUARDADO</Text>
        <Text style={s.savingsHeroValue}>{fmt(d.saved)}</Text>
        <Text style={s.savingsHeroCaption}>Saldo principal: {fmt(d.balance)}</Text>
      </View>
      <Text style={s.formSection}>Movimentar cofrinho</Text>
      <Field label="Valor (R$)" value={val} onChangeText={setVal} numeric placeholder="0,00" />
      <Btn label="Guardar dinheiro" onPress={() => act(1)} />
      <Btn label="Resgatar dinheiro" ghost style={{ marginTop: 10 }} onPress={() => act(-1)} />
      <View style={s.noticeCard}>
        <Text style={s.noticeSymbol}>i</Text>
        <Text style={s.noticeText}>O cofrinho é uma separação visual de saldo. Não há rendimento ou aplicação financeira nesta versão.</Text>
      </View>
    </>
  );
}

function Face({ setD, back }) {
  const [perm, req] = useCameraPermissions();
  const ref = useRef(null);
  const [step, setStep] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const steps = ['Olhe diretamente para a câmera', 'Vire levemente o rosto para o lado', 'Simule a conferência de um documento'];
  if (!perm) return <View style={s.cameraPlaceholder}><Text style={s.cameraHint}>Preparando câmera…</Text></View>;
  if (!perm.granted) {
    return (
      <View style={s.gateCard}>
        <IconBox icon="◉" size={54} active />
        <Text style={s.gateTitle}>Câmera necessária</Text>
        <Text style={s.gateText}>Permita o uso da câmera para visualizar o fluxo demonstrativo de verificação.</Text>
        <Btn label="Permitir câmera" onPress={req} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }
  const snap = async () => {
    if (busy || !cameraReady) return;
    setBusy(true);
    try { await ref.current?.takePictureAsync({ quality: 0.2, skipProcessing: true }); } catch (e) {}
    setBusy(false);
    if (step < 2) setStep(step + 1);
    else {
      setD((p) => ({ ...p, faceStatus: 'sent' }));
      Alert.alert('Solicitação registrada', 'O fluxo foi concluído localmente. Nenhuma fotografia foi armazenada ou enviada para uma instituição financeira.', [{ text: 'Concluir', onPress: back }]);
    }
  };
  return (
    <>
      <Text style={s.pageTitle}>Verificação de identidade</Text>
      <Text style={s.pageSubtitle}>Etapa {step + 1} de 3 • {steps[step]}</Text>
      <View style={s.camBox}>
        <CameraView ref={ref} style={{ flex: 1 }} facing="front" onCameraReady={() => setCameraReady(true)} />
        <View style={s.oval} />
      </View>
      <View style={s.stepDots}>
        {[0, 1, 2].map((i) => <View key={i} style={[s.stepDot, i <= step && s.stepDotActive]} />)}
      </View>
      <Btn label={busy ? 'Aguarde…' : step < 2 ? 'Continuar' : 'Concluir demonstração'} disabled={!cameraReady || busy} onPress={snap} style={{ marginTop: 14 }} />
      <View style={s.noticeCard}>
        <Text style={s.noticeSymbol}>i</Text>
        <Text style={s.noticeText}>Esta tela apenas demonstra o fluxo de verificação. As imagens capturadas não são salvas nem transmitidas.</Text>
      </View>
    </>
  );
}

function Dev({ d, setD, addTx, back }) {
  const [f, setF] = useState({ name: d.name, balance: String(d.balance), limit: String(d.limit), interest: String(d.interest), interestType: d.interestType, maxInst: String(d.maxInst), loan: String(d.loan), face: d.face });
  const [adj, setAdj] = useState('');
  const set = (k) => (v) => setF((prev) => ({ ...prev, [k]: v }));
  const save = () => {
    const fs = f.face !== d.face ? 'none' : d.faceStatus;
    setD({ ...d, name: f.name.trim() || 'Cliente', balance: num(f.balance), limit: num(f.limit), interest: num(f.interest), interestType: f.interestType, maxInst: Math.max(1, Math.min(60, Math.round(num(f.maxInst)))), loan: Math.max(0, num(f.loan)), face: f.face, faceStatus: fs });
    Alert.alert('Alterações salvas', 'Os dados da conta demonstrativa foram atualizados.', [{ text: 'OK', onPress: back }]);
  };
  const adjust = (sign) => {
    const v = num(adj);
    if (v <= 0) return Alert.alert('Valor inválido', 'Digite um valor maior que zero.');
    const nd = addTx({ ...d, balance: d.balance + sign * v }, sign > 0 ? 'Crédito de ajuste' : 'Débito de ajuste', sign * v, 'Ajuste manual de demonstração');
    setD(nd);
    setF((prev) => ({ ...prev, balance: String(nd.balance) }));
    setAdj('');
  };
  const clear = () => Alert.alert('Limpar extrato?', 'Todas as movimentações locais serão apagadas.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Limpar', style: 'destructive', onPress: () => setD((p) => ({ ...p, txs: [] })) }]);
  const reset = () => Alert.alert('Resetar conta?', 'Saldo, limites, cofrinho e extrato voltarão aos valores iniciais.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Resetar', style: 'destructive', onPress: () => { setD(INIT); back(); } }]);
  const statusTxt = { none: 'Não iniciada', sent: 'Aguardando aprovação local', approved: 'Aprovada no modo de demonstração' }[d.faceStatus] || 'Não iniciada';
  return (
    <>
      <Pill>FERRAMENTAS LOCAIS</Pill>
      <Text style={[s.pageTitle, { marginTop: 12 }]}>Configurar conta</Text>
      <Text style={s.pageSubtitle}>As alterações afetam somente os dados salvos neste dispositivo.</Text>
      <Text style={s.formSection}>Dados do titular</Text>
      <Field label="Nome exibido no aplicativo" value={f.name} onChangeText={set('name')} autoCapitalize="words" />
      <Text style={s.formSection}>Saldos e limites</Text>
      <Field label="Saldo em conta (R$)" value={f.balance} onChangeText={set('balance')} numeric />
      <Field label="Limite total (R$)" value={f.limit} onChangeText={set('limit')} numeric />
      <Field label="Dívida de empréstimo (R$)" value={f.loan} onChangeText={set('loan')} numeric />
      <Text style={s.formSection}>Parâmetros do empréstimo</Text>
      <Field label="Juros ao mês (%)" value={f.interest} onChangeText={set('interest')} numeric />
      <Text style={s.label}>Método de juros</Text>
      <Chips opts={[[ 'simples', 'Simples' ], [ 'composto', 'Composto' ]]} value={f.interestType} onChange={set('interestType')} />
      <Field label="Máximo de parcelas" value={f.maxInst} onChangeText={set('maxInst')} keyboard="number-pad" />
      <View style={s.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.serviceTitle}>Exigir verificação demonstrativa</Text>
          <Text style={s.serviceDesc}>Bloqueia serviços até a validação local</Text>
        </View>
        <Switch value={f.face} onValueChange={set('face')} trackColor={{ false: C.line, true: C.goldSoft }} thumbColor={f.face ? C.gold2 : '#C7C7C7'} />
      </View>
      <Text style={s.fieldHint}>Status atual: {statusTxt}. A verificação não é vinculada a um sistema bancário.</Text>
      <Btn label="Salvar alterações" onPress={save} style={{ marginTop: 16 }} />
      <Btn label="Aprovar verificação (teste)" ghost style={{ marginTop: 10 }} onPress={() => { setD((p) => ({ ...p, faceStatus: 'approved' })); Alert.alert('Verificação aprovada', 'Os serviços protegidos foram liberados nesta demonstração.'); }} />
      <Text style={s.formSection}>Ajuste rápido de saldo</Text>
      <Field label="Valor do ajuste (R$)" value={adj} onChangeText={setAdj} numeric placeholder="0,00" />
      <View style={s.inlineButtons}>
        <Btn label="Adicionar" style={{ flex: 1 }} onPress={() => adjust(1)} />
        <Btn label="Remover" ghost style={{ flex: 1 }} onPress={() => adjust(-1)} />
      </View>
      <Text style={s.formSection}>Manutenção</Text>
      <Btn label="Limpar extrato" ghost onPress={clear} />
      <Btn label="Resetar conta demonstrativa" danger ghost style={{ marginTop: 10 }} onPress={reset} />
      <Text style={s.profileFoot}>A senha e os dados desta área são locais e não constituem proteção de segurança bancária.</Text>
    </>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  loading: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: C.gold2, fontSize: 18, fontWeight: '700', marginTop: 14, fontFamily: 'serif' },
  lockRoot: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 28, paddingTop: (StatusBar.currentHeight || 36) + 30, paddingBottom: 34, justifyContent: 'space-between' },
  lockBrand: { alignItems: 'center', marginTop: 20 },
  lockBrandName: { color: C.gold2, fontSize: 30, fontWeight: '700', fontFamily: 'serif', marginTop: 16, letterSpacing: 0.4 },
  lockBrandCaption: { color: C.muted, fontSize: 12, marginTop: 6 },
  lockAccess: { alignItems: 'center', marginBottom: 16 },
  lockTitle: { color: C.text, fontSize: 23, fontWeight: '700' },
  lockName: { color: C.gold2, fontSize: 17, marginTop: 7 },
  fpWrap: { width: 142, height: 142, borderRadius: 71, borderWidth: 1, borderColor: C.goldSoft, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', marginTop: 28, marginBottom: 18 },
  fpInner: { width: 106, height: 106, borderRadius: 53, borderWidth: 1, borderColor: C.line, backgroundColor: '#101214', alignItems: 'center', justifyContent: 'center' },
  fpProgress: { position: 'absolute', width: 153, height: 153, borderRadius: 77, borderWidth: 3, borderColor: C.gold2 },
  lockHint: { color: C.text, fontSize: 14 },
  lockFoot: { color: C.faint, fontSize: 11, marginTop: 25 },
  header: { paddingTop: (StatusBar.currentHeight || 36) + 7, paddingHorizontal: 20, paddingBottom: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.line, minHeight: 82 },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brand: { color: C.gold2, fontSize: 20, fontWeight: '800', fontFamily: 'serif', letterSpacing: 0.3 },
  brandCaption: { color: C.faint, fontSize: 8, letterSpacing: 1, marginTop: 2 },
  avatar: { width: 39, height: 39, borderRadius: 20, backgroundColor: C.surface3, borderWidth: 1, borderColor: C.goldSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.gold2, fontSize: 13, fontWeight: '800' },
  backButton: { width: 70, flexDirection: 'row', alignItems: 'center' },
  backGlyph: { color: C.gold2, fontSize: 34, lineHeight: 34, marginRight: 3 },
  backText: { color: C.gold2, fontSize: 13, fontWeight: '600' },
  headerTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  pageContent: { paddingHorizontal: 20, paddingTop: 21, paddingBottom: 34 },
  bottomNav: { minHeight: 67, flexDirection: 'row', backgroundColor: '#101214', borderTopWidth: 1, borderTopColor: C.line, paddingBottom: Platform.OS === 'ios' ? 16 : 5, paddingTop: 6 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  navLabel: { color: C.faint, fontSize: 10, marginTop: 1 },
  navLabelActive: { color: C.gold2, fontWeight: '700' },
  navIndicator: { position: 'absolute', top: -6, width: 18, height: 2, borderRadius: 2, backgroundColor: C.gold },
  greetingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 17 },
  greeting: { color: C.text, fontSize: 23, fontWeight: '700', letterSpacing: -0.3 },
  greetingSub: { color: C.muted, fontSize: 12, marginTop: 4 },
  balanceCard: { backgroundColor: C.surface, borderRadius: 21, borderWidth: 1, borderColor: '#3B3427', padding: 19, overflow: 'hidden' },
  balanceCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balanceLabel: { color: C.gold2, fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  accountType: { color: C.muted, fontSize: 12, marginTop: 5 },
  eyeButton: { width: 35, height: 35, borderRadius: 18, backgroundColor: C.surface3, alignItems: 'center', justifyContent: 'center' },
  balanceAmount: { color: C.text, fontSize: 31, fontWeight: '700', letterSpacing: -0.7, marginTop: 13, marginBottom: 16 },
  cardDivider: { height: 1, backgroundColor: C.line, marginVertical: 14 },
  balanceMetaRow: { flexDirection: 'row', alignItems: 'center' },
  metaLabel: { color: C.muted, fontSize: 10, marginBottom: 5 },
  metaValue: { color: C.text, fontSize: 14, fontWeight: '700' },
  metaDivider: { width: 1, height: 34, backgroundColor: C.line, marginHorizontal: 13 },
  cardAccent: { position: 'absolute', width: 130, height: 130, borderRadius: 65, borderWidth: 1, borderColor: 'rgba(197,161,90,0.10)', top: -75, right: -35 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  sectionTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  sectionAction: { color: C.gold2, fontSize: 12, fontWeight: '600' },
  quickGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  quickItem: { width: '23%', alignItems: 'center' },
  quickLabel: { color: C.text, fontSize: 10, fontWeight: '600', textAlign: 'center', marginTop: 8 },
  savingsBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 13, marginTop: 16 },
  savingsTitle: { color: C.text, fontSize: 13, fontWeight: '700' },
  savingsText: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  chevron: { color: C.gold2, fontSize: 26, marginLeft: 7 },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.line },
  txRowCompact: { paddingVertical: 10 },
  txTitle: { color: C.text, fontSize: 12, fontWeight: '600' },
  txDate: { color: C.faint, fontSize: 10, marginTop: 4 },
  txDetail: { color: C.muted, fontSize: 10, marginTop: 4 },
  txValue: { fontSize: 11, fontWeight: '700', textAlign: 'right' },
  pageTitle: { color: C.text, fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  pageSubtitle: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 5, marginBottom: 19 },
  serviceRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 15, padding: 12, marginBottom: 10 },
  serviceTitle: { color: C.text, fontSize: 13, fontWeight: '700' },
  serviceDesc: { color: C.muted, fontSize: 10, marginTop: 4, lineHeight: 15 },
  noticeCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: 'rgba(130,169,201,0.07)', borderRadius: 13, borderWidth: 1, borderColor: 'rgba(130,169,201,0.17)', padding: 13, marginTop: 20 },
  noticeSymbol: { width: 19, height: 19, borderRadius: 10, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', color: C.blue, borderWidth: 1, borderColor: C.blue, fontSize: 12, fontWeight: '700', marginRight: 10 },
  noticeText: { flex: 1, color: C.muted, fontSize: 10, lineHeight: 16 },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 17, borderWidth: 1, borderColor: C.line, padding: 15, marginTop: 17 },
  profileAvatar: { width: 58, height: 58, borderRadius: 30, backgroundColor: '#27231A', borderWidth: 1, borderColor: C.goldSoft, alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  profileAvatarText: { color: C.gold2, fontSize: 20, fontWeight: '800' },
  profileName: { color: C.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  profileCaption: { color: C.muted, fontSize: 10, marginBottom: 7 },
  profileFoot: { color: C.faint, fontSize: 10, textAlign: 'center', marginTop: 22, lineHeight: 16 },
  detailCard: { backgroundColor: C.surface, borderRadius: 15, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14 },
  detailRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailLabel: { color: C.muted, fontSize: 11 },
  detailValue: { color: C.text, fontSize: 12, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 38, paddingHorizontal: 24, backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.line, marginTop: 14 },
  emptyTitle: { color: C.text, fontSize: 14, fontWeight: '700', marginTop: 13 },
  emptyText: { color: C.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 6 },
  filterBar: { marginTop: 5, marginBottom: 8 },
  tabs: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.line, padding: 4, marginBottom: 19 },
  tab: { flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: 9 },
  tabOn: { backgroundColor: '#3A3020' },
  tabTxt: { color: C.muted, fontSize: 12, fontWeight: '600' },
  tabTxtOn: { color: C.gold2 },
  formSection: { color: C.text, fontSize: 14, fontWeight: '700', marginTop: 15, marginBottom: 12 },
  label: { color: C.muted, fontSize: 11, fontWeight: '600', marginBottom: 7 },
  fieldWrap: { marginBottom: 15 },
  input: { minHeight: 49, backgroundColor: C.surface, color: C.text, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  fieldHint: { color: C.faint, fontSize: 10, marginTop: 6, lineHeight: 15 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 13 },
  chip: { borderWidth: 1, borderColor: C.line, borderRadius: 9, backgroundColor: C.surface, paddingHorizontal: 13, paddingVertical: 10, marginRight: 7, marginBottom: 7 },
  chipOn: { borderColor: C.goldSoft, backgroundColor: 'rgba(197,161,90,0.13)' },
  chipText: { color: C.muted, fontSize: 11, fontWeight: '600' },
  chipTextOn: { color: C.gold2 },
  formFootnote: { backgroundColor: C.surface, borderRadius: 10, padding: 11, marginBottom: 16 },
  formFootnoteText: { color: C.muted, fontSize: 10, lineHeight: 15 },
  btn: { minHeight: 49, backgroundColor: C.gold, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.gold },
  btnGhost: { backgroundColor: 'transparent', borderColor: C.goldSoft },
  btnDanger: { backgroundColor: 'transparent', borderColor: 'rgba(217,120,114,0.5)' },
  btnTxt: { color: '#111111', fontWeight: '800', fontSize: 13 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: C.goldSoft, padding: 22 },
  modalIcon: { alignItems: 'center', marginBottom: 15 },
  modalTitle: { color: C.text, fontSize: 19, fontWeight: '700', textAlign: 'center' },
  modalText: { color: C.muted, fontSize: 11, textAlign: 'center', lineHeight: 17, marginTop: 7, marginBottom: 18 },
  gateCard: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 23, alignItems: 'center', marginTop: 10 },
  gateTitle: { color: C.text, fontSize: 17, fontWeight: '700', marginTop: 15, marginBottom: 7, textAlign: 'center' },
  gateText: { color: C.muted, fontSize: 11, lineHeight: 18, textAlign: 'center', marginBottom: 17 },
  cameraPlaceholder: { height: 300, backgroundColor: C.surface, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cameraHint: { color: C.muted, fontSize: 12 },
  camBox: { height: 360, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: C.line, backgroundColor: '#000' },
  scanFrame: { position: 'absolute', left: '8%', right: '8%', top: '36%', height: 92, borderWidth: 2, borderColor: C.gold2, borderRadius: 10, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.04)' },
  scanLine: { height: 1.5, backgroundColor: C.gold2 },
  camHintWrap: { position: 'absolute', bottom: 15, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 15 },
  camHint: { color: C.text, fontSize: 11 },
  oval: { position: 'absolute', alignSelf: 'center', top: '10%', width: 215, height: 275, borderRadius: 110, borderWidth: 2, borderColor: C.gold2, borderStyle: 'dashed' },
  stepDots: { flexDirection: 'row', justifyContent: 'center', marginTop: 17, gap: 8 },
  stepDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.line },
  stepDotActive: { width: 19, backgroundColor: C.gold },
  loanSummary: { backgroundColor: C.surface, borderRadius: 17, borderWidth: 1, borderColor: C.line, padding: 16, marginBottom: 13 },
  loanSummaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  loanAvailable: { color: C.text, fontSize: 27, fontWeight: '700', marginTop: 11 },
  installmentCard: { backgroundColor: C.surface, borderRadius: 15, borderWidth: 1, borderColor: C.line, padding: 15, marginBottom: 17 },
  installmentValue: { color: C.gold2, fontSize: 24, fontWeight: '700', marginTop: 6 },
  installmentSuffix: { color: C.muted, fontSize: 12, fontWeight: '400' },
  inlineButtons: { flexDirection: 'row', gap: 10 },
  savingsHero: { backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: '#3B3427', padding: 22, alignItems: 'center', marginTop: 13, marginBottom: 8 },
  savingsHeroIcon: { width: 65, height: 65, borderRadius: 34, borderWidth: 1, borderColor: C.goldSoft, backgroundColor: '#211D16', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  savingsHeroLabel: { color: C.muted, fontSize: 9, letterSpacing: 1.4, fontWeight: '800' },
  savingsHeroValue: { color: C.text, fontSize: 29, fontWeight: '700', marginTop: 8 },
  savingsHeroCaption: { color: C.muted, fontSize: 11, marginTop: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 13, borderWidth: 1, borderColor: C.line, padding: 13, marginTop: 8 },
});

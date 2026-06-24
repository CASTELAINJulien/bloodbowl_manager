// =============================================================
// pdf-export.js - Génération PDF des équipes (style bbtc.pl)
// =============================================================
// À placer dans le dossier frontend/ à côté de app.js, styles.css
// =============================================================

// jsPDF et autoTable sont chargés via index.html en scripts UMD globaux
const { jsPDF } = window.jspdf;

// =============================================================
// Configuration visuelle (couleurs Netblitz)
// =============================================================
const COLORS = {
  black: [0, 0, 0],
  yellow: [245, 197, 24],
  blood: [214, 32, 47],
  grayDark: [50, 50, 50],
  grayText: [80, 80, 80],
  grayLight: [200, 200, 200],
  bgGray: [240, 240, 240],
  white: [255, 255, 255],
};

// =============================================================
// Génération du PDF
// =============================================================
export function generateTeamPDF(team, roster, availableInducements = []) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;

  // ============ PAGE 1 : ROSTER ============
  let y = margin;

  // Bandeau noir avec liseré jaune
  doc.setFillColor(...COLORS.black);
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setFillColor(...COLORS.yellow);
  doc.rect(0, 30, pageWidth, 1.5, 'F');
  doc.setFillColor(...COLORS.blood);
  doc.rect(0, 31.5, pageWidth, 0.8, 'F');

  // Logo de l'équipe (si présent), à gauche du titre
  let titleX = margin;
  if (team.logo) {
    try {
      const box = 22;
      const props = doc.getImageProperties(team.logo);
      const ratio = props.width / props.height;
      let w = box, h = box;
      if (ratio > 1) h = box / ratio; else w = box * ratio;
      doc.addImage(team.logo, 'PNG', margin + (box - w) / 2, 4 + (box - h) / 2, w, h);
      titleX = margin + box + 6;
    } catch (e) { /* logo invalide : ignoré */ }
  }

  // Titre : nom de la race
  doc.setTextColor(...COLORS.yellow);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(roster.name.toUpperCase(), titleX, 18);

  // Coach + équipe
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Nom du coach', pageWidth - margin - 60, 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(team.coach_name || '—', pageWidth - margin - 60, 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Nom d\'équipe', pageWidth - margin - 60, 22);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(team.name || '—', pageWidth - margin - 60, 27);

  y = 40;

  // ============ Encarts SIDELINE / SUMMARY ============
  doc.setTextColor(...COLORS.black);

  // Calcul Team Value
  const playersGoldCost = team.players.reduce((s, p) => s + (p.cost || 0), 0);
  const progressionTV = team.players.reduce((s, p) => s + (p.extras_cost || 0), 0);
  const playersCost = playersGoldCost + progressionTV;
  const rerollsCost = (team.rerolls || 0) * roster.rerollCost;
  const apoCost = (team.apothecary || 0) * 50;
  const acCost = (team.assistant_coaches || 0) * 10;
  const chCost = (team.cheerleaders || 0) * 10;
  const fansCost = Math.max(0, (team.dedicated_fans || 0) - 1) * 10;
  const sidelineCost = rerollsCost + apoCost + acCost + chCost + fansCost;
 
  // Calcul des inducements achetés
  const teamInducements = team.inducements || {};
  const purchasedInducements = availableInducements
    .map(ind => ({ ...ind, qty: teamInducements[ind.key] || 0 }))
    .filter(ind => ind.qty > 0);
  const inducementsCost = purchasedInducements.reduce(
    (s, ind) => s + ind.qty * ind.effectiveCost, 0
  );
 
  const totalTV = playersCost + sidelineCost + inducementsCost;
  // 3 colonnes : SIDELINE, INDUCEMENTS (vide pour l'instant), SUMMARY
  const boxWidth = (pageWidth - margin * 2 - 8) / 3;
  drawBox(doc, margin, y, boxWidth, 'PERSONNEL', [
    ['Apothicaire', team.apothecary ? 'Yes' : 'No'],
    ['Assistant coachs', String(team.assistant_coaches || 0)],
    ['Cheerleaders', String(team.cheerleaders || 0)],
    ['Fans dévoués', String(team.dedicated_fans || 0)],
    ['Re-rolls', String(team.rerolls || 0)],
  ]);
  const inducementLines = purchasedInducements.length > 0
    ? purchasedInducements.slice(0, 5).map(ind => [
        // Tronquer le label si trop long pour l'encart
        ind.label.length > 22 ? ind.label.substring(0, 20) + '…' : ind.label,
        `${ind.qty}× ${ind.qty * ind.effectiveCost}k`,
      ])
    : [['Aucun', '—']];
  drawBox(doc, margin + boxWidth + 4, y, boxWidth, 'COUPS DE POUCE', inducementLines);
  const summaryLines = [
    ['Prix des joueurs', `${playersGoldCost}k`],
  ];
  if (progressionTV > 0) {
    summaryLines.push(['Progressions', `+${progressionTV}k`]);
  }
  summaryLines.push(['Personnel', `${sidelineCost}k`]);
  if (inducementsCost > 0) {
    summaryLines.push(['Coups de pouce', `${inducementsCost}k`]);
  }
  summaryLines.push(['VALEUR D\'EQUIPE', `${totalTV}k`]);
  drawBox(doc, margin + (boxWidth + 4) * 2, y, boxWidth, 'RECAPITULATIF', summaryLines, true);
  y += 38;

  // ============ Tableau des joueurs ============
  const sortedPlayers = [...team.players].sort((a, b) => a.number - b.number);
  const tableBody = sortedPlayers.map(p => {
    // Stats avec bonus
    const realMa = p.ma + (p.stat_ma_bonus || 0);
    const realSt = p.st + (p.stat_st_bonus || 0);
    const realAg = p.ag !== null ? Math.max(1, p.ag - (p.stat_ag_bonus || 0)) : null;
    const realPa = (p.pa !== null && p.pa !== undefined && p.pa !== '-')
      ? Math.max(1, p.pa - (p.stat_pa_bonus || 0)) : null;
    const realAv = p.av + (p.stat_av_bonus || 0);

    const fmtStat = (val, bonus, asPlus) => {
      if (val === null || val === undefined) return '-';
      const display = asPlus ? val + '+' : String(val);
      return bonus ? '[' + display + ']' : display;
    };

    // Skills : on stocke base / extras / règles séparément pour les rendre
    // différemment dans didDrawCell (règles = gras + étoile).
    const extraSkills = p.extra_skills || [];
    const ruleNames = (p.special_rules ? String(p.special_rules).split(' | ') : [])
      .map(r => r.split(' :')[0].trim()).filter(Boolean);
    const baseSkills = p.skills || [];
    const allSkillsStr = [
      ...baseSkills,
      ...ruleNames.map(r => '* ' + r),
      ...extraSkills,
    ].join(', ') || '—';

    const totalCost = (p.cost || 0) + (p.extras_cost || 0);

    return [
      String(p.number),
      p.position_title,
      fmtStat(realMa, p.stat_ma_bonus, false),
      fmtStat(realSt, p.stat_st_bonus, false),
      fmtStat(realAg, p.stat_ag_bonus, true),
      fmtStat(realPa, p.stat_pa_bonus, true),
      fmtStat(realAv, p.stat_av_bonus, true),
      {
        content: allSkillsStr,
        _baseSkills: baseSkills,
        _extraSkills: extraSkills,
        _ruleNames: ruleNames,
      },
      `${totalCost}k`,
    ];
  });

  doc.autoTable({
    startY: y,
    head: [['#', 'POSTE', 'MA', 'ST', 'AG', 'PA', 'AV', 'SKILLS', 'COST']],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.6,
      lineColor: COLORS.grayLight,
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: COLORS.yellow,
      textColor: COLORS.black,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8, fontStyle: 'bold' },
      1: { cellWidth: 32 },
      2: { halign: 'center', cellWidth: 9 },
      3: { halign: 'center', cellWidth: 9 },
      4: { halign: 'center', cellWidth: 9 },
      5: { halign: 'center', cellWidth: 9 },
      6: { halign: 'center', cellWidth: 9 },
      7: { cellWidth: 'auto', fontSize: 6.8 },
      8: { halign: 'right', cellWidth: 14, fontStyle: 'bold' },
    },
    didDrawCell: (data) => {
      // On ne traite que la colonne Skills (index 7) du body
      if (data.section !== 'body' || data.column.index !== 7) return;
      const raw = data.cell.raw;
      if (!raw || typeof raw !== 'object') return;

      const baseSkills = raw._baseSkills || [];
      const extraSkills = raw._extraSkills || [];
      const ruleNames = raw._ruleNames || [];
      if (extraSkills.length === 0 && ruleNames.length === 0) return;  // rien de spécial

      // Effacer le contenu original que autoTable a déjà dessiné
      const cell = data.cell;
      doc.setFillColor(...COLORS.white);
      doc.rect(cell.x, cell.y, cell.width, cell.height, 'F');
      // Re-dessiner la bordure
      doc.setDrawColor(...COLORS.grayLight);
      doc.setLineWidth(0.1);
      doc.rect(cell.x, cell.y, cell.width, cell.height);

      doc.setFontSize(6.8);
      const pad = cell.padding('left');
      const startX = cell.x + pad;
      const maxX = cell.x + cell.width - pad;

      // Tokens stylés : base (gris normal), règles (gris gras + étoile), acquis (rouge gras)
      const tokens = [];
      baseSkills.forEach(s => tokens.push({ text: s, bold: false, color: COLORS.grayText }));
      ruleNames.forEach(s => tokens.push({ text: '* ' + s, bold: true, color: COLORS.grayText }));
      extraSkills.forEach(s => tokens.push({ text: s, bold: true, color: COLORS.blood }));

      const sepW = () => { doc.setFont('helvetica', 'normal'); return doc.getTextWidth(', '); };

      // Passe de mesure : nombre de lignes avec la même logique de wrap que le rendu
      let lines = 1, x = startX, atStart = true;
      for (const t of tokens) {
        doc.setFont('helvetica', t.bold ? 'bold' : 'normal');
        const tW = doc.getTextWidth(t.text);
        if (!atStart && x + sepW() + tW > maxX) { lines++; x = startX; atStart = true; }
        if (!atStart) x += sepW();
        x += tW; atStart = false;
      }

      // Hauteur de ligne (compressée si besoin pour tenir dans la cellule), bloc centré
      let lineH = 2.8;
      const avail = cell.height - 1.4;
      if (lines * lineH > avail) lineH = avail / lines;
      let yLine = cell.y + (cell.height - lines * lineH) / 2 + lineH * 0.72;

      // Passe de rendu
      x = startX; atStart = true;
      for (const t of tokens) {
        doc.setFont('helvetica', t.bold ? 'bold' : 'normal');
        const tW = doc.getTextWidth(t.text);
        if (!atStart && x + sepW() + tW > maxX) { yLine += lineH; x = startX; atStart = true; }
        if (!atStart) {
          doc.setFont('helvetica', 'normal'); doc.setTextColor(...COLORS.grayText);
          doc.text(', ', x, yLine); x += sepW();
        }
        doc.setFont('helvetica', t.bold ? 'bold' : 'normal');
        doc.setTextColor(...t.color);
        doc.text(t.text, x, yLine); x += tW;
        atStart = false;
      }
      doc.setTextColor(...COLORS.black);
    },
    didDrawPage: () => {
      // Pied de page
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.grayDark);
      doc.text('Généré par NETBLITZ · BB Manager', margin, pageH - 6);
      doc.text(new Date().toLocaleDateString('fr-FR'), pageWidth - margin, pageH - 6, { align: 'right' });
    },
  });

  // Légende
  const legendShown = sortedPlayers.some(p => (p.extra_skills?.length > 0) || p.stat_ma_bonus || p.stat_st_bonus || p.stat_ag_bonus || p.stat_pa_bonus || p.stat_av_bonus);
  if (legendShown) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...COLORS.grayDark);
    doc.text(
     'Compétences en rouge gras : acquises   ·   Stats entre [crochets] : améliorées',
      margin,
      doc.lastAutoTable.finalY + 4
    );
    doc.setTextColor(...COLORS.black);
  }

  // Règles spéciales des star players (descriptif complet)
  const starRules = [];
  for (const p of sortedPlayers) {
    if (p.is_star && p.special_rules) {
      String(p.special_rules).split(' | ').map(s => s.trim()).filter(Boolean)
        .forEach(text => { if (!starRules.includes(text)) starRules.push(text); });
    }
  }
  if (starRules.length) {
    let ry = doc.lastAutoTable.finalY + (legendShown ? 11 : 7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.black);
    doc.text('RÈGLES SPÉCIALES', margin, ry);
    ry += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.grayText);
    for (const text of starRules) {
      const lines = doc.splitTextToSize('• ' + text, pageWidth - margin * 2);
      doc.text(lines, margin, ry);
      ry += lines.length * 3.6 + 2;
    }
    doc.setTextColor(...COLORS.black);
  }

  // Lancer le téléchargement
  const safeName = (team.name || 'team').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`${safeName}.pdf`);
}

// =============================================================
// Helper : encart titré
// =============================================================
function drawBox(doc, x, y, w, title, lines, highlight = false) {
  // Cadre
  doc.setDrawColor(...COLORS.grayLight);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, 34);

  // Titre
  doc.setFillColor(...(highlight ? COLORS.yellow : COLORS.bgGray));
  doc.rect(x, y, w, 5.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.black);
  doc.text(title, x + 2, y + 4);

  // Lignes
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  let yy = y + 9;
  for (const [k, v] of lines) {
    const isLast = highlight && k === 'VALEUR D\'EQUIPE';
    if (isLast) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.blood);
    }
    doc.text(k, x + 2, yy);
    doc.text(v, x + w - 2, yy, { align: 'right' });
    if (isLast) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.black);
    }
    yy += 4.5;
  }
}

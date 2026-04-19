import Phaser from "phaser";
import { ENEMIES } from "@/data/enemies";
import { TOWERS, TOWER_SLOTS } from "@/data/towers";
import { WAVES } from "@/data/waves";
import { RELICS } from "@/data/relics";
import { REWARD_TEMPLATES } from "@/data/rewards";
import { BASE_POSITION, MAP_HEIGHT, MAP_WIDTH, PATH_POINTS } from "@/data/path";
import { ChipManager } from "@/systems/ChipManager";
import { EnemyManager } from "@/systems/EnemyManager";
import { ProjectileManager } from "@/systems/ProjectileManager";
import { TowerManager } from "@/systems/TowerManager";
import { WaveManager } from "@/systems/WaveManager";
import { RelicManager } from "@/systems/RelicManager";
import { RewardFactory } from "@/systems/RewardFactory";
import { WaveModifierManager } from "@/systems/WaveModifierManager";
import { WAVE_MODIFIERS } from "@/data/waveModifiers";
import { BossController } from "@/systems/BossController";
import { audio } from "@/systems/AudioManager";
import { stats } from "@/systems/StatsRecorder";
import { storage } from "@/systems/StorageManager";
import { rng } from "@/systems/Rng";
import { UnlockManager } from "@/systems/UnlockManager";
import { AchievementManager } from "@/systems/AchievementManager";
import { ComboTracker } from "@/systems/ComboTracker";
import { SynergyManager } from "@/systems/SynergyManager";
import { ComboChip } from "@/ui/ComboChip";
import { HUD } from "@/ui/HUD";
import { TowerPicker } from "@/ui/TowerPicker";
import { TowerInfoPanel } from "@/ui/TowerInfoPanel";
import { BossHpOverlay, PhaseCallout } from "@/ui/BossHpOverlay";
import { PauseOverlay } from "@/ui/PauseOverlay";
import { SettingsOverlay } from "@/ui/SettingsOverlay";
import { AchievementToast } from "@/ui/AchievementToast";
import { TutorialHint } from "@/ui/TutorialHint";
import { Tooltip } from "@/ui/Tooltip";
import { applyLetterSpacing, dur, ease, hex, palette, textStyle, type } from "@/ui/theme";
import type { BetweenWavesData, BetweenWavesResolution } from "@/scenes/BetweenWavesScene";
import type { ModifierPickSceneData, ModifierPickResult } from "@/scenes/ModifierPickScene";
import type { UnlockSceneData } from "@/scenes/UnlockScene";
import { CHARACTERS } from "@/data/characters";
import { PACTS } from "@/data/pacts";
import { PactManager } from "@/systems/PactManager";
import type { CharacterId, RelicId, TowerId, UnlockDefinition, WaveDefinition } from "@/types";

const INITIAL_CHIPS = 75;
const INITIAL_BASE_HP = 20;

/** Produces a shareable run identifier derived from the seeded RNG. */
function generateRunCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = (n: number): string => {
    let out = "";
    for (let i = 0; i < n; i += 1) {
      out += alphabet[Math.floor(rng.next() * alphabet.length)];
    }
    return out;
  };
  return `OVERLUCK-${pick(4)}-${pick(4)}`;
}

export class GameScene extends Phaser.Scene {
  private chips!: ChipManager;
  private enemies!: EnemyManager;
  private projectiles!: ProjectileManager;
  private towers!: TowerManager;
  private synergies!: SynergyManager;
  private waves!: WaveManager;
  private relics!: RelicManager;
  private rewardFactory!: RewardFactory;
  private waveModifiers!: WaveModifierManager;
  private bossController!: BossController;
  private unlockManager!: UnlockManager;
  private achievementManager!: AchievementManager;
  private achievementToast!: AchievementToast;
  private combo = new ComboTracker();
  private comboChip!: ComboChip;
  private tutorialHint!: TutorialHint;
  private pendingUnlocks: UnlockDefinition[] = [];
  private hud!: HUD;
  private towerPicker!: TowerPicker;
  private towerInfoPanel!: TowerInfoPanel;
  private bossOverlay!: BossHpOverlay;
  private phaseCallout!: PhaseCallout;
  private dangerVignette!: Phaser.GameObjects.Graphics;
  private bossTintOverlay!: Phaser.GameObjects.Rectangle;
  private sharedTooltip!: Tooltip;
  private runCode = "";
  private runSeed = 0;
  private dealerCritPenalty = 0;
  private charFireRateMult = 1;
  private charCritBonus = 0;
  private charChipRewardMult = 0;
  private deathCards = 0;
  private pauseOverlay!: PauseOverlay;
  private settingsOverlay!: SettingsOverlay;
  private speedMultiplier: 1 | 2 = 1;

  private baseHp = INITIAL_BASE_HP;
  private baseHpMax = INITIAL_BASE_HP;
  private gameOver = false;
  private victory = false;
  private paused = false;
  private baseSprite?: Phaser.GameObjects.Rectangle;

  public constructor() {
    super({ key: "GameScene" });
  }

  public create(): void {
    this.baseHp = INITIAL_BASE_HP;
    this.baseHpMax = INITIAL_BASE_HP;
    this.gameOver = false;
    this.victory = false;
    this.paused = false;

    this.drawBackground();
    this.drawPath();
    this.drawSpawnMarker();
    this.drawBase();
    this.drawAmbientMotes();
    this.drawVignette();

    // Seed the global RNG first so every downstream system is deterministic.
    // If launched as a daily challenge the seed is date-derived.
    const sceneData = this.scene.settings.data as { seed?: number; characterId?: CharacterId } | undefined;
    this.runSeed = sceneData?.seed ?? (Date.now() ^ (Math.random() * 0xffffffff));
    rng.seed(this.runSeed);

    // Character loadout
    const charId = sceneData?.characterId ?? "novato";
    const charDef = CHARACTERS[charId];
    let extraChips = 0;
    let extraBaseHp = 0;
    this.charFireRateMult = 1;
    this.charCritBonus = 0;
    this.charChipRewardMult = 0;
    for (const p of charDef.passives) {
      switch (p.kind) {
        case "extra_chips":        extraChips += p.value; break;
        case "extra_base_hp":      extraBaseHp += Math.round(p.value); break;
        case "tower_fire_rate_mult": this.charFireRateMult *= p.value; break;
        case "crit_bonus":         this.charCritBonus += p.value; break;
        case "chip_reward_mult":   this.charChipRewardMult += p.value; break;
      }
    }

    // Permanent pact bonuses (meta-progression)
    const pactMgr = new PactManager(PACTS, storage.load());
    extraChips += pactMgr.extraChips();
    extraBaseHp += pactMgr.extraBaseHp();
    this.charFireRateMult *= pactMgr.towerFireRateMult();
    this.charCritBonus += pactMgr.critBonus();
    this.charChipRewardMult += pactMgr.chipRewardMult();

    this.baseHp += extraBaseHp;
    this.baseHpMax += extraBaseHp;

    this.chips = new ChipManager(INITIAL_CHIPS + extraChips);
    this.relics = new RelicManager(RELICS);
    if (charDef.startingRelic) this.relics.acquire(charDef.startingRelic);
    this.deathCards = this.relics.deathCardCount();
    this.relics.onChange(() => { this.deathCards = this.relics.deathCardCount(); });
    this.waveModifiers = new WaveModifierManager(WAVE_MODIFIERS);
    this.rewardFactory = new RewardFactory({
      templates: REWARD_TEMPLATES,
      relics: this.relics,
      random: () => rng.next(),
    });

    this.runCode = generateRunCode();
    stats.startRun(this.time.now);

    // Unlock evaluator: queue newly-unlocked items to show AFTER the next
    // reward phase so we don't interrupt the action mid-flow.
    this.pendingUnlocks = [];
    this.unlockManager = new UnlockManager({
      onUnlocked: (def) => this.pendingUnlocks.push(def),
    });

    // Achievement system: toast in top-right when criteria are first met.
    this.achievementToast = new AchievementToast(this, MAP_WIDTH);
    this.achievementManager = new AchievementManager({
      onUnlocked: (def) => this.achievementToast.push(def),
    });

    // Pause menu + settings overlays share a `paused` suspension with the
    // rest of the game so tweens/time don't advance while they are open.
    this.pauseOverlay = new PauseOverlay(this, MAP_WIDTH, MAP_HEIGHT, {
      onResume: () => this.resumeGame(),
      onSettings: () => {
        this.pauseOverlay.close();
        this.settingsOverlay.open();
      },
      onRestart: () => this.scene.restart(),
    });
    this.settingsOverlay = new SettingsOverlay(this, MAP_WIDTH, MAP_HEIGHT, () => {
      // After closing settings, reopen pause if we were paused.
      if (this.paused && !this.pauseOverlay.isOpen()) this.pauseOverlay.open();
    });

    // Vignette rojo pulsante cuando HP base está crítico. Hidden by default.
    this.dangerVignette = this.add.graphics();
    this.dangerVignette.setDepth(95);
    this.dangerVignette.setScrollFactor(0);
    this.redrawDangerVignette(0);

    // Fullscreen warm tint overlay that fades in on boss phase transitions.
    // Using MULTIPLY blend so colors shift instead of dimming the scene.
    this.bossTintOverlay = this.add.rectangle(0, 0, MAP_WIDTH, MAP_HEIGHT, 0xff3d55, 0);
    this.bossTintOverlay.setOrigin(0, 0);
    this.bossTintOverlay.setDepth(90);
    this.bossTintOverlay.setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.bossTintOverlay.setScrollFactor(0);

    const rewardForKill = (enemy: { definition: { id: import("@/types").EnemyId; chipReward: number } }) => {
      const base = enemy.definition.chipReward;
      const relicMult = this.relics.chipRewardMultiplier();
      const modMult = this.waveModifiers.chipRewardMult();
      // Kill-streak multiplier decays if kills stop coming.
      const snap = this.combo.onKill();
      const comboMult = snap.multiplier;
      const charMult = 1 + this.charChipRewardMult;
      const reward = Math.max(1, Math.round(base * relicMult * modMult * comboMult * charMult));
      stats.onEnemyKilled(enemy.definition.id, reward);
      return reward;
    };

    this.projectiles = new ProjectileManager(this, {
      onEnemyKilled: (enemy) => {
        this.chips.add(rewardForKill(enemy));
      },
    });

    this.enemies = new EnemyManager(this, PATH_POINTS, ENEMIES, {
      onEnemyKilled: (enemy) => {
        this.chips.add(rewardForKill(enemy));
      },
      onEnemyReachedBase: (enemy) => {
        this.applyBaseDamage(enemy.definition.damageToBase);
      },
    });

    // Boss overlay + controller wire-up. Phase enter triggers callout + bar
    // color shift; summons go through the EnemyManager; shield pulse applies
    // invulnerability to the boss itself (set by the controller).
    this.bossOverlay = new BossHpOverlay(this, MAP_WIDTH);
    this.phaseCallout = new PhaseCallout(this, MAP_WIDTH, MAP_HEIGHT);
    this.bossController = new BossController(this, {
      onPhaseEnter: (phase, index) => {
        this.bossOverlay.setPhase(phase);
        this.phaseCallout.show(phase);
        audio.playBossPhase(index);
        // Color-grade: phase index fades in a crimson MULTIPLY overlay.
        // Phase 0 = 0; 1 = faint warm; 2+ = strong crimson.
        const alphaByPhase = [0, 0.18, 0.38];
        const targetAlpha = alphaByPhase[Math.min(index, alphaByPhase.length - 1)];
        this.tweens.add({
          targets: this.bossTintOverlay,
          fillAlpha: targetAlpha,
          duration: 600,
          ease: ease.inOut,
        });
        if (index >= 2) this.cameras.main.shake(420, 0.008);
      },
      onSummon: (enemyId, count) => {
        const overrides = {
          hpMult: this.waveModifiers.enemyHpMult(),
          speedMult: this.waveModifiers.enemySpeedMult(),
        };
        for (let i = 0; i < count; i += 1) {
          this.time.delayedCall(i * 220, () => this.enemies.spawn(enemyId, overrides));
        }
      },
      onShieldPulse: (durationMs) => {
        this.bossOverlay.triggerShieldPulse(durationMs);
      },
      onSpeedBoost: (_mult) => {
        this.cameras.main.shake(200, 0.006);
      },
      onChipDrain: (fraction) => {
        const amount = Math.floor(this.chips.value * fraction);
        if (amount > 0) this.chips.spend(amount);
        this.hud.flashStatus(`EL CRUPIER ROBA ${amount} FICHAS`, 2000);
        this.cameras.main.shake(300, 0.008);
      },
      onTowerJam: (durationMs) => {
        this.towers.jamAll(durationMs);
        this.hud.flashStatus(`TORRES BLOQUEADAS · ${(durationMs / 1000).toFixed(1)}s`, 2000);
        this.cameras.main.flash(200, 200, 100, 0, false);
      },
      onHouseEdge: (critPenalty) => {
        this.dealerCritPenalty += critPenalty;
        this.synergies.setGlobalCritOffset(this.charCritBonus - this.dealerCritPenalty);
        this.hud.flashStatus(`VENTAJA DE LA CASA  ·  -${Math.round(critPenalty * 100)}% CRIT`, 2500);
      },
      onBossDefeated: () => {
        this.bossOverlay.hide();
        this.cameras.main.flash(260, 255, 209, 102, false);
        this.cameras.main.shake(420, 0.012);
        // Hit-stop: brief pause on the frame of the kill for weight.
        this.applyHitStop(120);
      },
      onBossEscaped: () => {
        this.bossOverlay.hide();
      },
    });

    // Let the enemy manager notify the boss controller about newly spawned
    // enemies so phases/abilities kick in automatically.
    this.enemies.onSpawn((enemy) => {
      this.bossController.register(enemy);
      if (enemy.definition.fullscreenHpBar) {
        this.bossOverlay.show(enemy.definition.displayName, enemy.definition.color);
      }
    });

    this.towers = new TowerManager(
      this,
      TOWER_SLOTS,
      TOWERS,
      this.chips,
      this.projectiles,
      this.relics,
      this.waveModifiers,
      () => rng.next(),
    );
    if (this.charFireRateMult !== 1) this.towers.setGlobalFireRateMult(this.charFireRateMult);

    this.waves = new WaveManager(WAVES, this.enemies, {
      onWaveStart: (wave) => {
        audio.playWaveStart();
        stats.onWaveReached(wave.index);
        this.showWaveTitleCard(wave);
        this.tutorialHint.dismiss();
      },
      onWaveCleared: (wave) => {
        audio.playWaveClear();
        this.chips.add(wave.chipBonus);
        const relicBonus = this.relics.waveClearChipBonus();
        if (relicBonus > 0) this.chips.add(relicBonus);
        stats.onWaveCleared(wave.index);
        // Modifier is a one-shot bet for the wave that just finished.
        this.waveModifiers.clear();
        // Evaluate unlocks + achievements between waves.
        this.unlockManager.check();
        this.achievementManager.check();
        this.showClearCard(wave);
        this.openRewardPhase(wave);
      },
      onAllWavesCleared: () => {
        audio.playVictory();
        this.victory = true;
        const entry = stats.finalizeRun({ nowMs: this.time.now, won: true });
        this.time.delayedCall(900, () => this.showRunSummary(entry));
      },
    });
    this.waves.setModifiers({
      getOverrides: () => ({
        hpMult: this.waveModifiers.enemyHpMult(),
        speedMult: this.waveModifiers.enemySpeedMult(),
      }),
      extraEnemiesPerGroup: () => this.waveModifiers.extraEnemiesPerGroup(),
    });

    this.hud = new HUD(this, MAP_WIDTH, MAP_HEIGHT);
    const tooltip = new Tooltip(this, MAP_WIDTH, MAP_HEIGHT);
    this.hud.setTooltip(tooltip);
    this.sharedTooltip = tooltip;
    this.comboChip = new ComboChip(this, MAP_WIDTH);
    this.tutorialHint = new TutorialHint(this);

    // First-time tip: point at the first empty tower slot so the player
    // knows the core action. Dismissed when wave 1 starts.
    const profile = storage.load();
    if (profile.runsPlayed <= 1 && TOWER_SLOTS.length > 0) {
      const firstSlot = TOWER_SLOTS[0];
      this.time.delayedCall(600, () => {
        this.tutorialHint.show("Click aquí para colocar una torre", firstSlot.x, firstSlot.y - 4, 7000);
      });
    }

    // Tower roster: start with the base 3, plus any unlocked extras.
    const towerIds: TowerId[] = ["blaster", "gambler", "shock"];
    if (this.unlockManager.isUnlocked("tower_sniper")) towerIds.push("sniper");
    if (this.unlockManager.isUnlocked("tower_conduit")) towerIds.push("conduit");

    this.towerPicker = new TowerPicker(
      this,
      TOWERS,
      (id) => {
        this.selectTower(id);
        return true;
      },
      { x: 20, y: MAP_HEIGHT - 72 - 60, ids: towerIds },
    );
    this.towerPicker.attachTooltip(this.sharedTooltip);

    // Info panel for placed towers (handles upgrade flow)
    this.towerInfoPanel = new TowerInfoPanel(this, {
      chips: this.chips,
      onUpgradeRequested: (tower) => {
        const ok = this.towers.tryUpgradeTower(tower);
        if (ok) {
          stats.onTowerUpgraded();
          this.synergies.recompute(this.towers.getAllTowers());
        }
        return ok;
      },
      onSellRequested: (tower) => {
        const refund = this.towers.sellTower(tower);
        this.hud.flashStatus(`TORRE VENDIDA  +${refund} fichas`, 1400);
      },
      onMoveRequested: (tower) => {
        if (this.towers.beginRelocate(tower)) {
          this.hud.flashStatus("SELECCIONA UN SLOT  ·  ESC cancela", 2000);
        } else {
          this.hud.flashStatus("FICHAS INSUFICIENTES", 1200);
        }
      },
      getSellRefund: (tower) => Math.floor(tower.getInvestedChips() * 0.7),
      getRelocateFee: () => 15,
      getSynergyLabels: (tower) => this.synergies.getActiveLabels(tower),
    });
    this.synergies = new SynergyManager(this);
    if (this.charCritBonus !== 0) this.synergies.setGlobalCritOffset(this.charCritBonus);
    this.towers.onTowerClicked((tower) => this.towerInfoPanel.show(tower));
    this.towers.onTowerPlaced((tower) => {
      stats.onTowerPlaced(tower.definition.id);
      this.synergies.bind(tower);
      this.synergies.recompute(this.towers.getAllTowers());
    });
    this.towers.onTowerSold((tower, refund) => {
      if (this.towerInfoPanel.isOpen()) this.towerInfoPanel.hide();
      this.synergies.unbind(tower);
      this.synergies.recompute(this.towers.getAllTowers());
      this.hud.flashStatus(`TORRE VENDIDA  +${refund} fichas`, 1400);
    });
    this.towers.onTowerRelocated(() => {
      this.synergies.recompute(this.towers.getAllTowers());
    });

    // Disable the browser right-click menu so hold-RMB can be used to sell.
    this.input.mouse?.disableContextMenu();

    this.renderHUD();
    this.chips.onChange(() => {
      this.renderHUD();
      this.towerInfoPanel.refresh();
    });
    this.relics.onChange(() => this.renderHUD());

    this.input.keyboard?.on("keydown-SPACE", () => this.startNextWaveIfPossible());
    this.input.keyboard?.on("keydown-R", () => {
      if (this.gameOver || this.victory) this.scene.restart();
    });
    this.input.keyboard?.on("keydown-ESC", () => {
      if (this.settingsOverlay.isOpen()) {
        this.settingsOverlay.close();
        return;
      }
      if (this.towers.isRelocating()) {
        this.towers.cancelRelocate();
        return;
      }
      if (this.towerInfoPanel.isOpen()) {
        this.towerInfoPanel.hide();
        return;
      }
      if (this.pauseOverlay.isOpen()) this.resumeGame();
      else this.openPauseMenu();
    });

    // Speed toggle (T): 1× ↔ 2×. Affects tween + time scale.
    this.input.keyboard?.on("keydown-T", () => this.toggleSpeed());
    this.input.keyboard?.on("keydown-ONE", () => this.selectTower(towerIds[0]));
    this.input.keyboard?.on("keydown-TWO", () => towerIds[1] && this.selectTower(towerIds[1]));
    this.input.keyboard?.on("keydown-THREE", () => towerIds[2] && this.selectTower(towerIds[2]));
    this.input.keyboard?.on("keydown-FOUR", () => towerIds[3] && this.selectTower(towerIds[3]));
    this.input.keyboard?.on("keydown-FIVE", () => towerIds[4] && this.selectTower(towerIds[4]));
  }

  private selectTower(id: TowerId): void {
    if (this.paused || this.gameOver || this.victory) return;
    this.towers.selectTower(id);
    this.renderHUD();
  }

  private openRewardPhase(wave: WaveDefinition): void {
    if (this.victory || this.gameOver) return;
    const isLast = wave.index >= WAVES.length;
    if (isLast) return;

    this.paused = true;
    const offers = this.rewardFactory.roll(3);
    if (offers.length === 0) {
      this.paused = false;
      return;
    }

    const data: BetweenWavesData = {
      offers,
      waveJustClearedLabel: `${wave.displayName} despejada`,
      onResolved: (res) => this.resolveReward(res),
      random: () => rng.next(),
    };
    this.scene.launch("BetweenWavesScene", data);
  }

  private resolveReward(res: BetweenWavesResolution): void {
    this.paused = false;

    if (res.kind === "slot_bust") {
      const all = this.chips.value;
      if (all > 0) this.chips.spend(all);
      stats.onSlotPlayed(all);
      this.hud.flashStatus(res.displayName, 2400);
      this.cameras.main.shake(320, 0.01);
      return;
    }

    if (res.chipsDelta > 0) {
      this.chips.add(res.chipsDelta);
    } else if (res.chipsDelta < 0) {
      const current = this.chips.value;
      const penalty = Math.min(current, -res.chipsDelta);
      this.chips.spend(penalty);
    }

    if (res.kind === "relic" && res.relicId) {
      const id = res.relicId as RelicId;
      this.relics.acquire(id);
      stats.onRelicAcquired(id);
    }

    // Track casino mini-game participation for unlocks / achievements.
    if (res.kind === "slot_play") {
      stats.onSlotPlayed(res.chipsDelta < 0 ? -res.chipsDelta : 0);
    } else if (res.kind === "roulette_play") {
      stats.onRoulettePlayed();
    } else if (res.kind === "card_play") {
      stats.onCardsPlayed();
    }

    if (res.chipsDelta > 0) {
      this.hud.flashStatus(`${res.displayName}  +${res.chipsDelta} fichas`, 1600);
    } else if (res.chipsDelta < 0) {
      this.hud.flashStatus(`${res.displayName}  ${res.chipsDelta} fichas`, 1800);
    } else if (res.kind === "relic") {
      this.hud.flashStatus(`${res.displayName}  equipada`, 1600);
    }

    this.openModifierPhase();
  }

  private openModifierPhase(): void {
    if (this.victory || this.gameOver) return;
    const nextIndex = this.waves.getCurrentIndex() + 1;
    // Tutorial waves (1 and 2) skip the bet so players learn the base loop.
    if (nextIndex < 2) {
      this.paused = false;
      return;
    }
    const nextWave = WAVES[nextIndex];
    if (!nextWave) {
      this.paused = false;
      return;
    }

    const offerings = this.waveModifiers.pickOffering(() => rng.next(), 3, {
      rareBias: this.relics.rareModifierBias(),
    });
    if (offerings.length === 0) {
      this.paused = false;
      return;
    }

    this.paused = true;
    const data: ModifierPickSceneData = {
      offerings,
      nextWaveLabel: nextWave.displayName,
      onResolved: (res) => this.resolveModifier(res),
    };
    this.scene.launch("ModifierPickScene", data);
  }

  private resolveModifier(res: ModifierPickResult): void {
    this.paused = false;
    if (res.modifierId) {
      const applied = this.waveModifiers.apply(res.modifierId);
      if (applied) {
        stats.onModifierAccepted(applied);
        // Immediate-effect modifiers (like pacto_sangriento) resolve now.
        const imm = applied.effects;
        if (imm.immediateChips) {
          this.chips.add(imm.immediateChips);
        }
        if (imm.immediateBaseDamage) {
          this.applyBaseDamage(imm.immediateBaseDamage);
        }
        this.hud.flashStatus(`PACTO  ${applied.displayName}`, 2200);
      }
    } else {
      stats.onModifierSkipped();
      this.hud.flashStatus("Sin apuesta", 1400);
    }
    this.renderHUD();
    this.consumePendingUnlocks();
  }

  private consumePendingUnlocks(): void {
    if (this.pendingUnlocks.length === 0) return;
    const toShow = this.pendingUnlocks;
    this.pendingUnlocks = [];
    this.paused = true;
    const data: UnlockSceneData = {
      unlocks: toShow,
      onResolved: () => {
        this.paused = false;
        this.renderHUD();
      },
    };
    this.scene.launch("UnlockScene", data);
  }

  public update(_time: number, deltaMs: number): void {
    if (this.gameOver || this.victory || this.paused) {
      this.renderHUD();
      return;
    }

    this.waves.update(deltaMs);
    this.enemies.update(deltaMs);
    this.towers.update(deltaMs, this.enemies.active);
    this.projectiles.update(deltaMs, this.enemies.active);
    this.bossController.update(deltaMs);
    this.combo.update(deltaMs);
    this.comboChip.update(this.combo.snapshot());

    // Stream boss HP to the dramatic overlay while the primary boss is alive.
    const primary = this.bossController.getPrimaryBoss();
    if (primary && primary.isAlive()) {
      const hp = primary.getHpRatio() * primary.definition.maxHp;
      this.bossOverlay.setHp(primary.getHpRatio(), hp, primary.definition.maxHp);
    }
    this.bossOverlay.update(deltaMs);

    // Danger vignette: fade + pulse intensity as HP falls below 33%.
    const hpRatio = this.baseHp / this.baseHpMax;
    if (hpRatio <= 0.33) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 220);
      const intensity = (1 - hpRatio / 0.33) * (0.6 + 0.4 * pulse);
      this.redrawDangerVignette(intensity);
    } else if (this.dangerVignette.alpha > 0) {
      this.redrawDangerVignette(0);
    }

    this.renderHUD();
  }

  private redrawDangerVignette(intensity: number): void {
    const g = this.dangerVignette;
    g.clear();
    if (intensity <= 0.001) {
      g.setAlpha(0);
      return;
    }
    g.setAlpha(1);
    const layers = 5;
    const maxAlpha = Math.min(0.55, intensity * 0.55);
    for (let i = 0; i < layers; i += 1) {
      const t = i / (layers - 1);
      const inset = 20 + t * 180;
      const alpha = maxAlpha * (1 - t);
      g.fillStyle(0xff3448, alpha);
      g.fillRect(0, 0, MAP_WIDTH, inset);
      g.fillRect(0, MAP_HEIGHT - inset, MAP_WIDTH, inset);
      g.fillRect(0, 0, inset, MAP_HEIGHT);
      g.fillRect(MAP_WIDTH - inset, 0, inset, MAP_HEIGHT);
    }
  }

  /**
   * Freeze the tween + time system briefly to add weight to impact moments.
   * Uses timeScale because `scene.pause()` would suspend input & rendering.
   */
  private applyHitStop(durationMs: number): void {
    const target = 0.25 * this.speedMultiplier;
    this.tweens.timeScale = target;
    this.time.timeScale = target;
    this.time.delayedCall(durationMs, () => {
      this.tweens.timeScale = this.speedMultiplier;
      this.time.timeScale = this.speedMultiplier;
    });
  }

  private openPauseMenu(): void {
    if (this.gameOver || this.victory) return;
    this.paused = true;
    this.pauseOverlay.open();
  }

  private resumeGame(): void {
    this.paused = false;
    this.pauseOverlay.close();
  }

  private toggleSpeed(): void {
    if (this.paused || this.gameOver || this.victory) return;
    this.speedMultiplier = this.speedMultiplier === 1 ? 2 : 1;
    this.tweens.timeScale = this.speedMultiplier;
    this.time.timeScale = this.speedMultiplier;
    this.hud.flashStatus(`VELOCIDAD  ${this.speedMultiplier}X`, 900);
  }

  private startNextWaveIfPossible(): void {
    if (this.gameOver || this.victory) return;
    if (!this.waves.canStartNext()) return;
    this.waves.startNext();
  }

  private applyBaseDamage(amount: number): void {
    this.baseHp = Math.max(0, this.baseHp - amount);
    audio.playBaseHit();

    this.cameras.main.shake(160, 0.006);
    this.cameras.main.flash(140, 255, 92, 108, false);
    if (this.baseSprite) {
      this.baseSprite.setFillStyle(palette.danger);
      this.time.delayedCall(120, () => this.baseSprite?.setFillStyle(palette.surfaceElevated));
    }

    if (this.baseHp <= 0 && !this.gameOver) {
      // Death card: cheat death once
      if (this.deathCards > 0) {
        this.deathCards -= 1;
        const restored = Math.max(3, Math.floor(this.baseHpMax * 0.25));
        this.baseHp = restored;
        this.hud.flashStatus(`CARTA DE MUERTE  ·  +${restored} HP`, 2500);
        this.cameras.main.flash(400, 220, 180, 255, false);
        this.cameras.main.shake(300, 0.01);
        return;
      }
      this.gameOver = true;
      audio.playGameOver();
      const entry = stats.finalizeRun({ nowMs: this.time.now, won: false });
      this.achievementManager.check();
      this.enemies.clear();
      this.projectiles.clear();
      this.cameras.main.shake(480, 0.012);
      this.cameras.main.flash(320, 255, 60, 80, false);
      this.time.delayedCall(900, () => this.showRunSummary(entry));
    }
  }

  private showWaveTitleCard(wave: WaveDefinition): void {
    const isBoss = wave.spawns.some((s) => s.enemyId === "boss");
    const color = isBoss ? palette.danger : palette.accent;

    const subLabel = this.add.text(
      MAP_WIDTH / 2,
      MAP_HEIGHT / 2 - 30,
      isBoss ? "ENFRENTAMIENTO FINAL" : "INICIO DE OLEADA",
      textStyle(type.overline, { color: `#${color.toString(16).padStart(6, "0")}` }),
    );
    subLabel.setOrigin(0.5, 0.5);
    subLabel.setDepth(300);
    applyLetterSpacing(subLabel, type.overline);

    const title = this.add.text(
      MAP_WIDTH / 2,
      MAP_HEIGHT / 2 + 4,
      wave.displayName.toUpperCase(),
      textStyle(type.h1),
    );
    title.setOrigin(0.5, 0.5);
    title.setDepth(300);
    applyLetterSpacing(title, type.h1);

    const rule1 = this.add.rectangle(MAP_WIDTH / 2 - 100, MAP_HEIGHT / 2 + 38, 140, 1, color, 0.6);
    const rule2 = this.add.rectangle(MAP_WIDTH / 2 + 100, MAP_HEIGHT / 2 + 38, 140, 1, color, 0.6);
    rule1.setOrigin(1, 0.5);
    rule2.setOrigin(0, 0.5);
    rule1.setDepth(300);
    rule2.setDepth(300);

    const targets = [subLabel, title, rule1, rule2];
    for (const t of targets) t.setAlpha(0);

    this.tweens.add({
      targets: [subLabel, title],
      alpha: 1,
      y: "-=6",
      duration: dur.base,
      ease: ease.out,
    });
    this.tweens.add({
      targets: rule1,
      alpha: 1,
      x: "-=60",
      duration: dur.base,
      delay: dur.quick,
      ease: ease.out,
    });
    this.tweens.add({
      targets: rule2,
      alpha: 1,
      x: "+=60",
      duration: dur.base,
      delay: dur.quick,
      ease: ease.out,
    });

    this.time.delayedCall(1100, () => {
      this.tweens.add({
        targets,
        alpha: 0,
        duration: dur.fast,
        ease: ease.out,
        onComplete: () => {
          for (const t of targets) t.destroy();
        },
      });
      this.showWaveCountdown(color);
    });
  }

  private showWaveCountdown(accentColor: number): void {
    const cx = MAP_WIDTH / 2;
    const cy = MAP_HEIGHT / 2 + 10;
    const accentHex = `#${accentColor.toString(16).padStart(6, "0")}`;

    const steps = [
      { label: "3", delay: 0 },
      { label: "2", delay: 400 },
      { label: "1", delay: 800 },
      { label: "¡YA!", delay: 1200 },
    ];

    for (const step of steps) {
      this.time.delayedCall(step.delay, () => {
        if (this.gameOver || this.victory) return;

        const isGo = step.label === "¡YA!";
        const num = this.add.text(cx, cy, step.label, {
          fontFamily:
            '"Inter", "SF Pro Text", "Segoe UI", system-ui, -apple-system, sans-serif',
          fontSize: isGo ? "60px" : "88px",
          color: isGo ? hex.primary : accentHex,
          fontStyle: "bold",
        });
        num.setOrigin(0.5, 0.5);
        num.setDepth(300);
        num.setLetterSpacing(isGo ? 6 : 2);

        // Shadow copy behind
        const shadow = this.add.text(cx + 3, cy + 5, step.label, {
          fontFamily:
            '"Inter", "SF Pro Text", "Segoe UI", system-ui, -apple-system, sans-serif',
          fontSize: isGo ? "60px" : "88px",
          color: "#000000",
          fontStyle: "bold",
        });
        shadow.setOrigin(0.5, 0.5);
        shadow.setDepth(299);
        shadow.setLetterSpacing(isGo ? 6 : 2);
        shadow.setAlpha(0);

        // Expanding ring behind the number
        const ring = this.add.circle(cx, cy, isGo ? 80 : 60, 0x000000, 0);
        ring.setStrokeStyle(2, accentColor, 0.8);
        ring.setDepth(299);

        num.setScale(isGo ? 0.6 : 1.5);
        num.setAlpha(0);
        shadow.setScale(isGo ? 0.6 : 1.5);

        this.tweens.add({
          targets: [num, shadow],
          scale: 1,
          alpha: 1,
          duration: dur.fast,
          ease: ease.snap,
        });
        this.tweens.add({
          targets: shadow,
          alpha: 0.4,
          duration: dur.fast,
          ease: ease.snap,
        });
        this.tweens.add({
          targets: ring,
          scale: { from: 0.5, to: 2.4 },
          alpha: { from: 0.8, to: 0 },
          duration: 400,
          ease: ease.out,
          onComplete: () => ring.destroy(),
        });

        this.time.delayedCall(isGo ? 500 : 320, () => {
          this.tweens.add({
            targets: [num, shadow],
            alpha: 0,
            scale: isGo ? 1.4 : 0.6,
            duration: dur.fast,
            ease: ease.out,
            onComplete: () => {
              num.destroy();
              shadow.destroy();
            },
          });
        });

        audio.playCountdown(isGo ? "go" : "number");
        if (isGo) {
          this.cameras.main.flash(140, 255, 209, 102, false);
        }
      });
    }
  }

  private showClearCard(wave: WaveDefinition): void {
    const container = this.add.container(MAP_WIDTH / 2, MAP_HEIGHT / 2);
    container.setDepth(300);

    const bg = this.add.graphics();
    bg.fillStyle(palette.surface, 0.94);
    bg.fillRoundedRect(-220, -52, 440, 104, 12);
    bg.lineStyle(1, palette.success, 0.8);
    bg.strokeRoundedRect(-220, -52, 440, 104, 12);

    const headline = this.add.text(0, -18, `${wave.displayName.toUpperCase()}`, textStyle(type.h3));
    headline.setOrigin(0.5, 0.5);

    const reward = this.add.text(0, 18, `+${wave.chipBonus} FICHAS`, textStyle(type.overline, { color: hex.success }));
    reward.setOrigin(0.5, 0.5);
    applyLetterSpacing(reward, type.overline);

    container.add([bg, headline, reward]);
    container.setScale(0.85);
    container.setAlpha(0);

    this.tweens.add({
      targets: container,
      scale: 1,
      alpha: 1,
      duration: dur.fast,
      ease: ease.snap,
    });

    this.time.delayedCall(1300, () => {
      this.tweens.add({
        targets: container,
        alpha: 0,
        y: MAP_HEIGHT / 2 - 20,
        duration: dur.fast,
        ease: ease.out,
        onComplete: () => container.destroy(),
      });
    });
  }

  private showRunSummary(entry: import("@/types").RunHistoryEntry): void {
    // Award gems based on performance
    const gemsEarned = Math.floor(entry.waveCleared / 2) + (entry.won ? 5 : 0);
    if (gemsEarned > 0) {
      const profile = storage.load();
      profile.gems = (profile.gems ?? 0) + gemsEarned;
      storage.save(profile);
    }
    this.scene.launch("RunSummaryScene", { entry, runCode: this.runCode, seed: this.runSeed, gemsEarned });
  }

  /** Compact description of the next wave's composition, e.g. "8× swarm · 3× bruiser". */
  private formatWavePreview(): string {
    const next = this.waves.peekNextWave();
    if (!next) return "";
    const counts = new Map<string, number>();
    for (const spawn of next.spawns) {
      const def = ENEMIES[spawn.enemyId];
      const label = def?.displayName ?? spawn.enemyId;
      counts.set(label, (counts.get(label) ?? 0) + spawn.count);
    }
    const parts: string[] = [];
    for (const [label, count] of counts) parts.push(`${count}× ${label}`);
    return parts.slice(0, 3).join("  ·  ");
  }

  private renderHUD(): void {
    const currentWave: WaveDefinition | null = this.waves.getCurrentWave();
    const status = this.waves.getStatus();
    const total = this.waves.getTotalWaves();
    const idx = currentWave ? currentWave.index : 0;

    const statusText = "";

    let actionHint = "";
    let actionPrimary = false;
    if (this.gameOver || this.victory) {
      actionHint = "R para reiniciar";
    } else if (this.paused) {
      actionHint = "Elige una recompensa";
    } else if (this.waves.canStartNext()) {
      const preview = this.formatWavePreview();
      actionHint = preview
        ? `APROXIMÁNDOSE  ${preview}   ·   SPACE iniciar`
        : "ESPACIO iniciar oleada   ·   1 / 2 / 3 cambiar torre   ·   click en slot para colocar";
      actionPrimary = true;
    } else if (status === "spawning" || status === "clearing") {
      actionHint = "Oleada en curso   ·   1 / 2 / 3 cambiar torre";
    }

    const selectedDef = this.towers.getSelectedDefinition();

    this.hud.render({
      chips: this.chips.value,
      baseHp: this.baseHp,
      baseHpMax: this.baseHpMax,
      waveLabel: idx > 0 ? `OLEADA ${idx} / ${total}` : `OLEADA 0 / ${total}`,
      waveProgress: status === "idle" ? "LISTA" : status === "spawning" ? "SPAWNEANDO" : status === "clearing" ? "LIMPIANDO" : "FINAL",
      towerName: selectedDef.displayName,
      towerCost: selectedDef.cost,
      towerColor: selectedDef.color,
      enemiesAlive: this.enemies.activeCount(),
      relics: this.relics.active,
      activeModifier: this.waveModifiers?.activeModifier ?? null,
      statusText,
      actionHint,
      actionPrimary,
    });

    this.towerPicker.render({
      selectedId: this.towers.getSelectedId(),
      chips: this.chips.value,
    });
  }

  private drawBackground(): void {
    const bg = this.add.rectangle(0, 0, MAP_WIDTH, MAP_HEIGHT, palette.bgDeep, 1);
    bg.setOrigin(0, 0);
    bg.setDepth(-10);

    // Subtle felt gradient
    const felt = this.add.graphics();
    felt.setDepth(-9.5);
    felt.fillGradientStyle(
      0x0c0a14,
      0x0c0a14,
      palette.bgDeep,
      palette.bgDeep,
      0.9,
      0.9,
      1,
      1,
    );
    felt.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    // Fine grid
    const grid = this.add.graphics();
    grid.setDepth(-9);
    grid.lineStyle(1, palette.hairline, 0.35);
    for (let x = 0; x <= MAP_WIDTH; x += 40) {
      grid.moveTo(x, 0);
      grid.lineTo(x, MAP_HEIGHT);
    }
    for (let y = 0; y <= MAP_HEIGHT; y += 40) {
      grid.moveTo(0, y);
      grid.lineTo(MAP_WIDTH, y);
    }
    grid.strokePath();

    // Coarse accent grid in gold
    const accent = this.add.graphics();
    accent.setDepth(-8);
    accent.lineStyle(1, palette.goldDeep, 0.22);
    for (let x = 0; x <= MAP_WIDTH; x += 160) {
      accent.moveTo(x, 0);
      accent.lineTo(x, MAP_HEIGHT);
    }
    for (let y = 0; y <= MAP_HEIGHT; y += 160) {
      accent.moveTo(0, y);
      accent.lineTo(MAP_WIDTH, y);
    }
    accent.strokePath();
  }

  private drawPath(): void {
    // Outer glow halo
    const halo = this.add.graphics();
    halo.setDepth(-7);
    halo.lineStyle(64, 0x3a1512, 0.25);
    this.tracePath(halo);

    // Asphalt base
    const asphalt = this.add.graphics();
    asphalt.setDepth(-6);
    asphalt.lineStyle(42, 0x120a08, 1);
    this.tracePath(asphalt);

    // Inner darker core for subtle depth
    const innerShade = this.add.graphics();
    innerShade.setDepth(-5.5);
    innerShade.lineStyle(24, 0x1f0f0a, 0.7);
    this.tracePath(innerShade);

    // Inner highlight streak
    const highlight = this.add.graphics();
    highlight.setDepth(-5);
    highlight.lineStyle(2, palette.gold, 0.18);
    this.tracePath(highlight);

    // Gold rim
    const rimOuter = this.add.graphics();
    rimOuter.setDepth(-4);
    rimOuter.lineStyle(2, palette.gold, 0.55);
    this.traceOffsetPath(rimOuter, 20);
    this.traceOffsetPath(rimOuter, -20);

    // Flowing chevrons (animated direction indicators)
    this.drawFlowingChevrons();
  }

  private tracePath(graphics: Phaser.GameObjects.Graphics): void {
    graphics.beginPath();
    graphics.moveTo(PATH_POINTS[0].x, PATH_POINTS[0].y);
    for (let i = 1; i < PATH_POINTS.length; i += 1) {
      graphics.lineTo(PATH_POINTS[i].x, PATH_POINTS[i].y);
    }
    graphics.strokePath();
  }

  private traceOffsetPath(graphics: Phaser.GameObjects.Graphics, offset: number): void {
    // Trace the path twice as parallel rim lines. For sharp corners we just
    // offset each segment perpendicularly - simple and readable.
    for (let i = 0; i < PATH_POINTS.length - 1; i += 1) {
      const a = PATH_POINTS[i];
      const b = PATH_POINTS[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      graphics.beginPath();
      graphics.moveTo(a.x + nx * offset, a.y + ny * offset);
      graphics.lineTo(b.x + nx * offset, b.y + ny * offset);
      graphics.strokePath();
    }
  }

  private drawFlowingChevrons(): void {
    // Precompute path length and segment offsets for interpolation.
    const segments: { a: { x: number; y: number }; b: { x: number; y: number }; length: number; cumulative: number }[] = [];
    let total = 0;
    for (let i = 0; i < PATH_POINTS.length - 1; i += 1) {
      const a = PATH_POINTS[i];
      const b = PATH_POINTS[i + 1];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      segments.push({ a, b, length, cumulative: total });
      total += length;
    }

    const chevronCount = Math.floor(total / 90);
    const chevrons: Phaser.GameObjects.Graphics[] = [];
    for (let i = 0; i < chevronCount; i += 1) {
      const g = this.add.graphics();
      g.setDepth(-3);
      g.fillStyle(palette.primary, 0.65);
      g.lineStyle(1, palette.goldDeep, 0.6);
      // Chevron pointing right (+x). We rotate + translate per frame.
      g.beginPath();
      g.moveTo(-6, -5);
      g.lineTo(2, 0);
      g.lineTo(-6, 5);
      g.lineTo(-3, 0);
      g.closePath();
      g.fillPath();
      g.strokePath();
      chevrons.push(g);
    }

    const state = { progress: 0 };
    this.tweens.add({
      targets: state,
      progress: 1,
      duration: 6000,
      repeat: -1,
      ease: "Linear",
      onUpdate: () => {
        for (let i = 0; i < chevrons.length; i += 1) {
          // Each chevron is evenly spaced and slides forward.
          const t = (i / chevrons.length + state.progress) % 1;
          const dist = t * total;
          let seg = segments[0];
          for (const s of segments) {
            if (dist >= s.cumulative && dist <= s.cumulative + s.length) {
              seg = s;
              break;
            }
          }
          const local = (dist - seg.cumulative) / (seg.length || 1);
          const x = seg.a.x + (seg.b.x - seg.a.x) * local;
          const y = seg.a.y + (seg.b.y - seg.a.y) * local;
          const angle = Math.atan2(seg.b.y - seg.a.y, seg.b.x - seg.a.x);

          // Fade in near edges to avoid pop-in at wrap
          const fade = Math.min(1, Math.min(t, 1 - t) * 8);

          chevrons[i].setPosition(x, y);
          chevrons[i].setRotation(angle);
          chevrons[i].setAlpha(fade * 0.75);
        }
      },
    });
  }

  private drawSpawnMarker(): void {
    const start = PATH_POINTS[0];
    const x = start.x + 44;
    const y = start.y;

    // Wide glow
    const halo = this.add.circle(x, y, 32, palette.primary, 0.12);
    halo.setDepth(3);
    this.tweens.add({
      targets: halo,
      scale: { from: 1, to: 1.35 },
      alpha: { from: 0.14, to: 0.05 },
      yoyo: true,
      repeat: -1,
      duration: 1400,
      ease: ease.inOut,
    });

    const ring = this.add.circle(x, y, 20, 0x000000, 0);
    ring.setStrokeStyle(2, palette.primary, 0.9);
    ring.setDepth(4);
    this.tweens.add({
      targets: ring,
      scale: { from: 1, to: 1.3 },
      alpha: { from: 0.9, to: 0.25 },
      yoyo: true,
      repeat: -1,
      duration: 900,
      ease: ease.inOut,
    });

    const innerRing = this.add.circle(x, y, 12, 0x000000, 0);
    innerRing.setStrokeStyle(1, palette.gold, 0.6);
    innerRing.setDepth(4);

    const core = this.add.circle(x, y, 5, palette.primary, 1);
    core.setDepth(5);
    this.tweens.add({
      targets: core,
      alpha: { from: 1, to: 0.5 },
      yoyo: true,
      repeat: -1,
      duration: 700,
      ease: ease.inOut,
    });

    // Forward arrow tick
    const arrow = this.add.graphics();
    arrow.setDepth(5);
    arrow.fillStyle(palette.primary, 0.9);
    arrow.beginPath();
    arrow.moveTo(x - 2, y - 4);
    arrow.lineTo(x + 4, y);
    arrow.lineTo(x - 2, y + 4);
    arrow.closePath();
    arrow.fillPath();

    // Label card
    const labelBg = this.add.graphics();
    labelBg.setDepth(5);
    labelBg.fillStyle(palette.surface, 0.92);
    labelBg.fillRoundedRect(x - 34, y - 48, 68, 18, 9);
    labelBg.lineStyle(1, palette.goldDeep, 0.7);
    labelBg.strokeRoundedRect(x - 34, y - 48, 68, 18, 9);

    const label = this.add.text(x, y - 39, "ENTRADA", textStyle(type.overline, { color: hex.primary }));
    label.setOrigin(0.5, 0.5);
    label.setDepth(6);
    applyLetterSpacing(label, type.overline);
  }

  private drawBase(): void {
    const bx = BASE_POSITION.x - 44;
    const by = BASE_POSITION.y;

    // Danger halo
    const halo = this.add.circle(bx, by, 62, palette.danger, 0.12);
    halo.setDepth(2);
    this.tweens.add({
      targets: halo,
      scale: { from: 1, to: 1.25 },
      alpha: { from: 0.14, to: 0.05 },
      yoyo: true,
      repeat: -1,
      duration: 1400,
      ease: ease.inOut,
    });

    // Pedestal shadow
    const shadow = this.add.ellipse(bx, by + 42, 64, 10, 0x000000, 0.5);
    shadow.setDepth(2);

    // Pedestal base plate
    const plate = this.add.graphics();
    plate.setDepth(3);
    plate.fillStyle(palette.surface, 1);
    plate.fillRoundedRect(bx - 28, by + 28, 56, 14, 3);
    plate.lineStyle(1, palette.goldDeep, 0.8);
    plate.strokeRoundedRect(bx - 28, by + 28, 56, 14, 3);

    // Main housing
    const housing = this.add.rectangle(bx, by, 44, 80, palette.surfaceElevated, 1);
    housing.setStrokeStyle(2, palette.danger, 1);
    housing.setDepth(3);
    this.baseSprite = housing;

    // Inner rail
    const rail = this.add.graphics();
    rail.setDepth(4);
    rail.lineStyle(1, palette.hairline, 0.8);
    rail.strokeRoundedRect(bx - 18, by - 34, 36, 68, 4);

    // Core light
    const core = this.add.rectangle(bx, by, 14, 46, palette.danger, 0.85);
    core.setDepth(4);
    this.tweens.add({
      targets: core,
      alpha: { from: 0.9, to: 0.45 },
      yoyo: true,
      repeat: -1,
      duration: 800,
      ease: ease.inOut,
    });

    // Core highlights (pip marks)
    const pips = this.add.graphics();
    pips.setDepth(5);
    pips.fillStyle(palette.primary, 0.8);
    for (let i = -1; i <= 1; i += 1) {
      pips.fillCircle(bx, by + i * 14, 2);
    }

    // Top antenna
    const antenna = this.add.graphics();
    antenna.setDepth(4);
    antenna.lineStyle(2, palette.danger, 1);
    antenna.beginPath();
    antenna.moveTo(bx, by - 40);
    antenna.lineTo(bx, by - 54);
    antenna.strokePath();
    const tip = this.add.circle(bx, by - 54, 3, palette.danger, 1);
    tip.setDepth(5);
    this.tweens.add({
      targets: tip,
      alpha: { from: 1, to: 0.3 },
      yoyo: true,
      repeat: -1,
      duration: 600,
      ease: ease.inOut,
    });

    // Label card
    const labelBg = this.add.graphics();
    labelBg.setDepth(5);
    labelBg.fillStyle(palette.surface, 0.92);
    labelBg.fillRoundedRect(bx - 26, by - 76, 52, 18, 9);
    labelBg.lineStyle(1, palette.dangerDeep, 0.8);
    labelBg.strokeRoundedRect(bx - 26, by - 76, 52, 18, 9);

    const label = this.add.text(bx, by - 67, "BASE", textStyle(type.overline, { color: hex.danger }));
    label.setOrigin(0.5, 0.5);
    label.setDepth(6);
    applyLetterSpacing(label, type.overline);
  }

  /**
   * Slow-drifting golden motes scattered across the map for ambient depth.
   * They live behind gameplay (depth -2) and never block interactions.
   */
  private drawAmbientMotes(): void {
    const count = 32;
    for (let i = 0; i < count; i += 1) {
      const x = Math.random() * MAP_WIDTH;
      const y = Math.random() * MAP_HEIGHT;
      const radius = 1 + Math.random() * 2;
      const alpha = 0.15 + Math.random() * 0.35;
      const mote = this.add.circle(x, y, radius, palette.gold, alpha);
      mote.setDepth(-2);
      const driftDuration = 6000 + Math.random() * 4000;
      const driftDistance = 30 + Math.random() * 60;
      this.tweens.add({
        targets: mote,
        y: y - driftDistance,
        alpha: { from: alpha, to: 0 },
        duration: driftDuration,
        ease: "Sine.InOut",
        repeat: -1,
        yoyo: true,
      });
    }
  }

  private drawVignette(): void {
    const vignette = this.add.graphics();
    vignette.setDepth(90);
    const steps = 6;
    for (let i = 0; i < steps; i += 1) {
      const alpha = 0.05 * (i + 1);
      const pad = 90 - i * 14;
      vignette.fillStyle(0x000000, alpha);
      vignette.fillRect(0, 0, MAP_WIDTH, pad);
      vignette.fillRect(0, MAP_HEIGHT - pad, MAP_WIDTH, pad);
      vignette.fillRect(0, 0, pad, MAP_HEIGHT);
      vignette.fillRect(MAP_WIDTH - pad, 0, pad, MAP_HEIGHT);
    }
  }
}

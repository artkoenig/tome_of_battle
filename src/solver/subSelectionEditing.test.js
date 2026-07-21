import { describe, it, expect, vi } from 'vitest';
import { withAddedInstance, withoutInstance, withChangedOptionCount } from './subSelectionEditing.js';

const COUNT_INCREASE = 1;
const COUNT_DECREASE = -1;

const selection = (id, optionDefinitionId, number) => ({
  id,
  entryLinkId: optionDefinitionId,
  name: `Auswahl ${id}`,
  ...(number === undefined ? {} : { number })
});

describe('withAddedInstance', () => {
  it('appends the new instance with an initial count of one', () => {
    const existing = [selection('sel-1', 'opt-sword', 2)];

    const result = withAddedInstance(existing, { id: 'sel-2', entryLinkId: 'opt-shield' });

    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({ id: 'sel-2', number: 1 });
  });

  it('appends a second instance of an option that is already present', () => {
    const existing = [selection('sel-1', 'opt-champion', 1)];

    const result = withAddedInstance(existing, { id: 'sel-2', entryLinkId: 'opt-champion' });

    expect(result.map(item => item.id)).toEqual(['sel-1', 'sel-2']);
  });

  it('leaves the list untouched when no instance could be created', () => {
    const existing = [selection('sel-1', 'opt-sword')];

    expect(withAddedInstance(existing, null)).toBe(existing);
  });

  it('does not mutate the given list', () => {
    const existing = [selection('sel-1', 'opt-sword')];

    withAddedInstance(existing, { id: 'sel-2', entryLinkId: 'opt-shield' });

    expect(existing).toHaveLength(1);
  });
});

describe('withoutInstance', () => {
  it('removes exactly the instance with the given selection id', () => {
    const existing = [selection('sel-1', 'opt-champion'), selection('sel-2', 'opt-champion')];

    const result = withoutInstance(existing, 'sel-1');

    expect(result.map(item => item.id)).toEqual(['sel-2']);
  });

  it('keeps the list content when the id is unknown', () => {
    const existing = [selection('sel-1', 'opt-champion')];

    expect(withoutInstance(existing, 'sel-unknown')).toEqual(existing);
  });
});

describe('withChangedOptionCount', () => {
  const neverCreates = () => {
    throw new Error('Es sollte keine Auswahl erzeugt werden');
  };

  it('raises the count of an already chosen option', () => {
    const existing = [selection('sel-1', 'opt-sword', 2)];

    const result = withChangedOptionCount(existing, 'opt-sword', COUNT_INCREASE, neverCreates);

    expect(result[0].number).toBe(3);
  });

  it('treats a missing count as one when raising it', () => {
    const existing = [selection('sel-1', 'opt-sword')];

    const result = withChangedOptionCount(existing, 'opt-sword', COUNT_INCREASE, neverCreates);

    expect(result[0].number).toBe(2);
  });

  it('creates the option through the given factory when it is not chosen yet', () => {
    const createInstance = vi.fn(() => ({ id: 'sel-new', entryLinkId: 'opt-sword' }));

    const result = withChangedOptionCount([], 'opt-sword', COUNT_INCREASE, createInstance);

    expect(createInstance).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ id: 'sel-new', entryLinkId: 'opt-sword', number: 1 }]);
  });

  it('lowers the count of an option chosen more than once', () => {
    const existing = [selection('sel-1', 'opt-sword', 3)];

    const result = withChangedOptionCount(existing, 'opt-sword', COUNT_DECREASE, neverCreates);

    expect(result[0].number).toBe(2);
  });

  it('drops the option from the list once its count reaches zero', () => {
    const existing = [selection('sel-1', 'opt-sword', 1), selection('sel-2', 'opt-shield', 1)];

    const result = withChangedOptionCount(existing, 'opt-sword', COUNT_DECREASE, neverCreates);

    expect(result.map(item => item.id)).toEqual(['sel-2']);
  });

  it('lowering an option that is not chosen changes nothing and creates nothing', () => {
    const existing = [selection('sel-1', 'opt-shield', 1)];
    const createInstance = vi.fn();

    const result = withChangedOptionCount(existing, 'opt-sword', COUNT_DECREASE, createInstance);

    expect(result).toBe(existing);
    expect(createInstance).not.toHaveBeenCalled();
  });

  it('matches an option by its direct entry id when no entry link is present', () => {
    const existing = [{ id: 'sel-1', selectionEntryId: 'opt-sword', number: 1 }];

    const result = withChangedOptionCount(existing, 'opt-sword', COUNT_INCREASE, neverCreates);

    expect(result[0].number).toBe(2);
  });

  it('does not mutate the given list or its entries', () => {
    const existing = [selection('sel-1', 'opt-sword', 2)];

    withChangedOptionCount(existing, 'opt-sword', COUNT_INCREASE, neverCreates);

    expect(existing[0].number).toBe(2);
  });
});

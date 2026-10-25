import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';
import App from './App';

beforeEach(() => localStorage.clear());

const orbs = () => screen.getAllByRole('button', { name: /^light \d, \d+ kelvin/i });

test('renders the card and a light', () => {
  const { container } = render(<App />);
  expect(container.querySelector('.card')).toBeInTheDocument();
  expect(orbs()).toHaveLength(1);
});

test('C shows the CSS, with box-shadow layers in raw values', () => {
  const { container } = render(<App />);
  fireEvent.keyDown(window, { key: 'c' });
  const code = container.querySelector('.code').textContent;
  expect(code).toContain('box-shadow:');
  expect(code).toContain('.card:hover');
  expect(code).not.toContain('var(');
});

test('lights can be added up to three and removed down to one', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Add a light' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add a light' }));
  expect(orbs()).toHaveLength(3);
  expect(screen.queryByRole('button', { name: 'Add a light' })).toBeNull();

  for (const n of [3, 2]) {
    fireEvent.click(screen.getByRole('button', { name: `Light ${n} settings` }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
  }
  expect(orbs()).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Light 1 settings' }));
  expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
});

test('a light button toggles its panel, and typed values change the light', () => {
  render(<App />);
  const chip = screen.getByRole('button', { name: 'Light 1 settings' });
  fireEvent.click(chip);
  const panel = screen.getByRole('region', { name: 'Light 1' });
  const warmth = within(panel).getByRole('textbox', { name: 'Warmth (K)' });

  fireEvent.change(warmth, { target: { value: '2700' } });
  fireEvent.keyDown(warmth, { key: 'Enter' });
  expect(screen.getByRole('button', { name: /^light 1, 2700 kelvin/i })).toBeInTheDocument();

  fireEvent.change(warmth, { target: { value: '99999' } });
  fireEvent.keyDown(warmth, { key: 'Enter' });
  expect(screen.getByRole('button', { name: /^light 1, 12000 kelvin/i })).toBeInTheDocument();

  fireEvent.click(chip);
  expect(screen.queryByRole('region', { name: 'Light 1' })).toBeNull();
});

test('pressing the floor or the card never moves a light', () => {
  const { container } = render(<App />);
  const where = () => orbs()[0].getAttribute('style');
  const before = where();
  for (const target of [container.querySelector('.stage'), container.querySelector('.card')]) {
    fireEvent.pointerDown(target, { button: 0, pointerId: 1, clientX: 100, clientY: 700 });
    fireEvent.pointerMove(target, { pointerId: 1, clientX: 900, clientY: 200 });
    fireEvent.pointerUp(target, { pointerId: 1, clientX: 900, clientY: 200 });
  }
  expect(where()).toBe(before);
});

test('one toggle, or L, hides the lights and their geometry but keeps their light', () => {
  const { container } = render(<App />);
  const lighting = () => [container.querySelector('.card').style.cssText, container.querySelector('.pool').style.cssText];
  const before = lighting();
  const toggle = screen.getByRole('button', { name: 'Hide lights and geometry' });
  expect(container.querySelector('.construction')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Show the geometry' })).toBeNull();

  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(container.querySelector('.stage')).toHaveClass('lights-hidden');
  expect(screen.queryAllByRole('button', { name: /^light \d, \d+ kelvin/i })).toHaveLength(0);
  expect(lighting()).toEqual(before);

  fireEvent.keyDown(window, { key: 'l' });
  expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(container.querySelector('.stage')).not.toHaveClass('lights-hidden');
  expect(orbs()).toHaveLength(1);
});

test('pressing the card sets it down 1px above the page, even as the pointer is captured', async () => {
  const { container } = render(<App />);
  const card = container.querySelector('.card');
  const label = () => container.querySelector('.card-elevation').textContent;
  const settle = () => new Promise(resolve => setTimeout(resolve, 1200));

  fireEvent.pointerEnter(card);
  fireEvent.pointerDown(card, { button: 0, pointerId: 1 });
  // Capturing the pointer on the stage makes the card see it leave.
  fireEvent.pointerLeave(card);
  await act(settle);
  expect(label()).toBe('↑ 1 px');

  fireEvent.pointerUp(card, { pointerId: 1 });
  await act(settle);
  expect(label()).toBe('↑ 16 px');
});

test('shortcuts stay out of the way while typing, and removed shortcuts do nothing', () => {
  const { container } = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Light 1 settings' }));
  const size = screen.getByRole('textbox', { name: 'Size (px ⌀)' });
  fireEvent.keyDown(size, { key: 'c' });
  expect(container.querySelector('.panel.open')).toBeNull();

  for (const key of ['n', 'd', 't', '1', 'ArrowUp', ']', '=', 'x']) fireEvent.keyDown(window, { key });
  expect(orbs()).toHaveLength(1);
  expect(container.querySelector('.stage')).not.toHaveClass('lights-hidden');
  expect(document.documentElement.dataset.theme).toBe('light');
});

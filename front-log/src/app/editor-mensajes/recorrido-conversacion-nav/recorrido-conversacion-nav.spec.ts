import { EditorBlock } from '../../shared/editor-blocks.service';
import { buildConversationTree } from './recorrido-conversacion-nav';

function block(
  id: string,
  order: number,
  destinations: readonly string[] = [],
): EditorBlock {
  return {
    block_id: id,
    orden_recorrido: order,
    grupo_recorrido: 'recorrido_principal',
    titulo: `Momento ${order}`,
    mensajes_previos: [],
    prompt: {
      message_key: `prompt_${order}`,
      label: `Mensaje ${order}`,
      content: `Contenido ${order}`,
      limite_caracteres: 999,
    },
    tiene_opciones: destinations.length > 0,
    acepta_nuevas_opciones: true,
    limites_alta: {
      titulo_botones: 19,
      titulo_lista: 23,
      descripcion_lista: 70,
      respuesta: 999,
    },
    formato: destinations.length > 0 ? 'botones' : 'sin_opciones',
    formato_motivo: '',
    presentacion: null,
    opciones: destinations.map((destination, index) => ({
      option_id: `option_${order}_${index}`,
      orden: index + 1,
      editable: true,
      sintetica: false,
      titulo: `Opción ${index}`,
      titulo_key: `title_${order}_${index}`,
      titulo_limite_caracteres: 19,
      titulo_boton: `Opción ${index}`,
      titulo_boton_key: `title_${order}_${index}`,
      titulo_boton_limite_caracteres: 19,
      descripcion: null,
      descripcion_key: null,
      descripcion_limite_caracteres: 70,
      respuesta: null,
      lleva_a: {
        state_id: `State${destination}`,
        label: `Momento ${destination}`,
        block_id: destination,
      },
    })),
  };
}

describe('buildConversationTree', () => {
  it('uses the first path, keeps traversal order and cuts cycles', () => {
    const tree = buildConversationTree([
      block('inicio', 1, ['espera']),
      block('espera', 2, ['registro', 'precios']),
      block('registro', 3, ['inicio']),
      block('precios', 4, ['registro']),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].block.titulo).toBe('Momento 1');
    expect(tree[0].children[0].block.titulo).toBe('Momento 2');
    expect(tree[0].children[0].children.map((node) => node.block.titulo)).toEqual([
      'Momento 3',
      'Momento 4',
    ]);
    expect(tree[0].children[0].children[0].children).toEqual([]);
  });

  it('assigns shared blocks to the shortest path with breadth-first traversal', () => {
    const tree = buildConversationTree([
      block('inicio', 1, ['a', 'b']),
      block('a', 2, ['profundo']),
      block('b', 3, ['compartido']),
      block('profundo', 4, ['compartido']),
      block('compartido', 5),
    ]);

    const a = tree[0].children[0];
    const b = tree[0].children[1];
    expect(a.children[0].block.block_id).toBe('profundo');
    expect(a.children[0].children).toEqual([]);
    expect(b.children[0].block.block_id).toBe('compartido');
  });
});
